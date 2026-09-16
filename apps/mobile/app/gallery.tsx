import { BottomSheet, Button, Column, Host, Row, Spacer, Text } from "@expo/ui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { PageLayout } from "../components/PageLayout";
import { useWebSocketContext } from "../components/WebSocketContext";
import {
  downloadCaptureStill,
  downloadLatestSnapshot,
  GalleryImage,
  listGalleryImages,
  seedAllGalleryCaches,
} from "../utils/galleryCache";
import { logger } from "../utils/logger";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 20;
const imageSize =
  (screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

export default function GalleryScreen() {
  const { ip, httpPort, lastImageReady } = useWebSocketContext();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const handledReadyAt = useRef<number | null>(null);

  const refreshLocal = useCallback(async () => {
    try {
      const listed = listGalleryImages();
      await seedAllGalleryCaches(listed);
      setImages(listed);
      setError(null);
    } catch (err) {
      logger.error("Gallery: failed to list local images", err);
      setError("Could not read local gallery cache");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshLocal();
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLocal]);

  useEffect(() => {
    if (!ip || !lastImageReady) {
      return;
    }
    if (handledReadyAt.current === lastImageReady.receivedAt) {
      return;
    }
    handledReadyAt.current = lastImageReady.receivedAt;

    let cancelled = false;
    (async () => {
      setFetching(true);
      setError(null);
      try {
        await downloadCaptureStill(
          ip,
          lastImageReady.fullPath,
          lastImageReady.imageId,
          httpPort
        );
        if (!cancelled) {
          await refreshLocal();
        }
      } catch (err) {
        logger.error("Gallery: capture download failed", err);
        if (!cancelled) {
          setError("Could not download capture — is the server reachable?");
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ip, httpPort, lastImageReady, refreshLocal]);

  const handleFetchLatest = async () => {
    if (!ip) {
      setError("No server IP — connect first");
      return;
    }
    setFetching(true);
    setError(null);
    try {
      if (lastImageReady?.fullPath) {
        await downloadCaptureStill(
          ip,
          lastImageReady.fullPath,
          lastImageReady.imageId,
          httpPort
        );
      } else {
        await downloadLatestSnapshot(ip, httpPort);
      }
      await refreshLocal();
    } catch (err) {
      logger.error("Gallery: snapshot download failed", err);
      setError(
        "Could not download image — capture a frame or start live preview first."
      );
    } finally {
      setFetching(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const renderItem = ({ item }: { item: GalleryImage }) => (
    <TouchableOpacity
      style={styles.imageItem}
      onPress={() => setSelected(item)}
      activeOpacity={0.8}
      testID={`gallery-item-${item.id}`}
    >
      <Image
        source={{ uri: item.uri, cacheKey: item.cacheKey }}
        style={styles.thumbnail}
        contentFit="cover"
        recyclingKey={item.cacheKey}
      />
    </TouchableOpacity>
  );

  return (
    <PageLayout title="Gallery" onBack={handleBack}>
      <Host colorScheme="dark" style={styles.host}>
        <Column spacing={12} style={{ paddingHorizontal: GRID_PADDING }}>
          <Row alignment="center" spacing={12}>
            <Button
              testID="gallery-fetch-latest"
              label={fetching ? "Fetching…" : "Fetch latest"}
              variant="outlined"
              disabled={fetching || !ip}
              onPress={handleFetchLatest}
            />
            <Spacer flexible />
            <Text textStyle={{ color: "#888888", fontSize: 13 }}>
              {`${images.length} ${images.length === 1 ? "image" : "images"}`}
            </Text>
          </Row>

          {error ? (
            <Text
              testID="gallery-error"
              textStyle={{ color: "#ff6b6b", fontSize: 13 }}
            >
              {error}
            </Text>
          ) : null}

          {loading ? (
            <Column spacing={12} alignment="center" style={{ padding: 40 }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text textStyle={{ color: "#666666", fontSize: 14 }}>
                Loading gallery…
              </Text>
            </Column>
          ) : images.length === 0 ? (
            <Column
              spacing={12}
              alignment="center"
              testID="gallery-empty"
              style={{ padding: 40 }}
            >
              <Text
                textStyle={{
                  color: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: "600",
                }}
              >
                No images yet
              </Text>
              <Text
                textStyle={{
                  color: "#666666",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                Capture from the viewfinder to pull the still automatically, or
                fetch the latest capture / live snapshot.
              </Text>
            </Column>
          ) : (
            <FlatList
              data={images}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={COLUMNS}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.row}
              showsVerticalScrollIndicator={false}
              testID="gallery-list"
            />
          )}
        </Column>
      </Host>

      <BottomSheet
        isPresented={selected !== null}
        onDismiss={() => setSelected(null)}
        snapPoints={["full"]}
        contentPadding={0}
        containerColor="#000000"
        showDragIndicator
        testID="gallery-fullscreen-sheet"
      >
        {selected ? (
          <View style={styles.fullWrap} testID="gallery-fullscreen-backdrop">
            <Image
              source={{ uri: selected.uri, cacheKey: selected.cacheKey }}
              style={styles.fullImage}
              contentFit="contain"
            />
            <Host colorScheme="dark" matchContents>
              <Button
                label="Close"
                variant="text"
                onPress={() => setSelected(null)}
              />
            </Host>
          </View>
        ) : null}
      </BottomSheet>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  grid: {
    paddingBottom: 24,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  imageItem: {
    width: imageSize,
    height: imageSize,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fullWrap: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 24,
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight * 0.75,
  },
});
