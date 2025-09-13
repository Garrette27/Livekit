// Setup verification script
// Run this with: node verify-setup.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying LiveKit + Firebase Setup...\n');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
const envExists = fs.existsSync(envPath);

if (!envExists) {
  console.log('❌ .env.local file not found!');
  console.log('📝 Please create a .env.local file with your configuration.');
  console.log('📖 See SETUP.md for required environment variables.\n');
} else {
  console.log('✅ .env.local file exists');
  
  // Read and check environment variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const requiredVars = [
    'NEXT_PUBLIC_LIVEKIT_URL',
    'LIVEKIT_API_KEY', 
    'LIVEKIT_API_SECRET',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];
  
  console.log('\n🔧 Checking required environment variables:');
  
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your_`)) {
      console.log(`✅ ${varName}`);
    } else {
      console.log(`❌ ${varName} - Not set or using placeholder value`);
    }
  });
}

// Check Firebase configuration files
console.log('\n📁 Checking Firebase configuration:');
const firebaseFiles = ['firebase.json', 'firestore.rules', 'firestore.indexes.json'];
firebaseFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
});

console.log('\n🚀 Next steps:');
console.log('1. Make sure all environment variables are set in .env.local');
console.log('2. Run: npm run dev');
console.log('3. Try creating a room');
console.log('4. Check browser console for any remaining errors');

console.log('\n📚 For detailed setup instructions, see:');
console.log('- SETUP.md');
console.log('- LIVEKIT_SETUP.md');
console.log('- ENVIRONMENT_SETUP.md');
