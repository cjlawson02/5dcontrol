# 5DControl - Professional Camera Remote Control 📷

A powerful camera control system for Canon DSLRs using React Native (Expo) and Go, with real-time MJPEG streaming over WiFi.

## 🚀 Quick Start

### Demo Mode (No Camera Required!)

Test all features without a physical camera. From the project root, run:

```bash
npm run dev:demo
```

This starts both the server (with mock camera) and mobile app using Turbo.

See [DEMO_MODE.md](DEMO_MODE.md) for more options and full details.

### Production Mode

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the server (with real camera)

   ```bash
   cd apps/server
   npm run dev
   ```

3. Start the mobile app

   ```bash
   cd apps/mobile
   npm run dev
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
