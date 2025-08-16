import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const API_KEY = 'demo-key-change-in-production';

async function testAPI() {
  console.log('🧪 Testing Remotion SSR API...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);

    // Test 2: Get compositions
    console.log('\n2. Testing get compositions...');
    const compositionsResponse = await fetch(`${API_BASE}/compositions`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const compositions = await compositionsResponse.json();
    console.log('✅ Compositions:', compositions.map(c => c.id));

    // Test 3: Render still
    console.log('\n3. Testing render still...');
    const stillResponse = await fetch(`${API_BASE}/render-still`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY 
      },
      body: JSON.stringify({
        compositionId: 'MyVideo',
        inputProps: {
          titleText: 'Test Still',
          titleColor: 'red'
        },
        frame: 30,
        imageFormat: 'png'
      })
    });
    
    if (stillResponse.ok) {
      const stillData = await stillResponse.json();
      console.log('✅ Still rendered:', stillData.filename);
    } else {
      console.log('❌ Still render failed:', await stillResponse.text());
    }

    // Test 4: Render video (this takes longer)
    console.log('\n4. Testing render video...');
    const videoResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY 
      },
      body: JSON.stringify({
        compositionId: 'MyVideo',
        inputProps: {
          titleText: 'Test Video',
          titleColor: 'blue'
        },
        codec: 'h264',
        quality: 80
      })
    });
    
    if (videoResponse.ok) {
      const videoData = await videoResponse.json();
      console.log('✅ Video rendered:', videoData.filename);
    } else {
      console.log('❌ Video render failed:', await videoResponse.text());
    }

    console.log('\n🎉 All tests completed!');
    console.log(`📁 Check the output folder for generated files`);
    console.log(`🌐 Visit ${API_BASE} for API documentation`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('Make sure the server is running: npm start');
  }
}

testAPI(); 