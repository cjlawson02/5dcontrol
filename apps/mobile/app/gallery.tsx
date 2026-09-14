import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PageLayout } from "../components/PageLayout";
import { useWebSocketContext } from "../components/WebSocketContext";
import {
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
  const { ip } = useWebSocketContext();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GalleryImage | null>(null);

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

  const handleFetchLatest = async () => {
    if (!ip) {
      setError("No server IP — connect first");
      return;
    }
    setFetching(true);
    setError(null);
    try {
      await downloadLatestSnapshot(ip);
      await refreshLocal();
    } catch (err) {
      logger.error("Gallery: snapshot download failed", err);
      setError(
        "Could not download photo.jpg — is the camera preview streaming?"
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
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.fetchButton, fetching && styles.fetchButtonDisabled]}
          onPress={handleFetchLatest}
          disabled={fetching || !ip}
          activeOpacity={0.7}
          testID="gallery-fetch-latest"
        >
          {fetching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="download" color="#fff" size={16} />
              <Text style={styles.fetchButtonText}>Fetch latest</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.countText}>
          {images.length} {images.length === 1 ? "image" : "images"}
        </Text>
      </View>

      {error ? (
        <Text style={styles.errorText} testID="gallery-error">
          {error}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.muted}>Loading gallery…</Text>
        </View>
      ) : images.length === 0 ? (
        <View style={styles.centered} testID="gallery-empty">
          <Feather name="image" color="#666" size={64} />
          <Text style={styles.emptyTitle}>No images yet</Text>
          <Text style={styles.muted}>
            Fetch the live snapshot from the server to start a local gallery.
            Full capture transfer over the wire is still on the roadmap.
          </Text>
        </View>
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

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelected(null)}
          testID="gallery-fullscreen-backdrop"
        >
          {selected ? (
            <Image
              source={{ uri: selected.uri, cacheKey: selected.cacheKey }}
              style={styles.fullImage}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GRID_PADDING,
    paddingVertical: 12,
  },
  fetchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(144, 144, 144, 0.5)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 130,
    justifyContent: "center",
  },
  fetchButtonDisabled: {
    opacity: 0.6,
  },
  fetchButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  countText: {
    color: "#888",
    fontSize: 13,
  },
  errorText: {
    color: "#ff6b6b",
    paddingHorizontal: GRID_PADDING,
    marginBottom: 8,
    fontSize: 13,
  },
  grid: {
    paddingHorizontal: GRID_PADDING,
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  muted: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight * 0.85,
  },
});
