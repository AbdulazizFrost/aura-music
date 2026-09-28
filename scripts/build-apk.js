const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('[AURA BUILD] Step 1: Bundling web assets...');
execSync('node scripts/bundle-app.js', { stdio: 'inherit' });

console.log('[AURA BUILD] Step 2: Syncing Capacitor Android platform...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('[AURA BUILD] Step 3: Compiling Android APK with Gradle...');
const env = {
  ...process.env,
  JAVA_HOME: 'C:\\Users\\Abdulaziz\\.jdk\\jdk-21',
  ANDROID_HOME: 'C:\\Users\\Abdulaziz\\AppData\\Local\\Android\\Sdk'
};

const androidDir = path.resolve(__dirname, '..', 'android');
execSync('.\\gradlew.bat assembleDebug', { cwd: androidDir, env, stdio: 'inherit' });

const apkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const apkDest = path.resolve(__dirname, '..', 'aura-music-debug.apk');

if (fs.existsSync(apkSource)) {
  fs.copyFileSync(apkSource, apkDest);
  const stats = fs.statSync(apkDest);
  console.log(`\n🎉 [AURA BUILD SUCCESS] APK generated successfully!`);
  console.log(`📁 File: ${apkDest}`);
  console.log(`📦 Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} else {
  console.error('[AURA BUILD ERROR] APK was not found at expected location.');
}
