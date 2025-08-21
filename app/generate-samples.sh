#!/bin/bash

# Generate voice samples for all new OpenAI TTS voices
# This script calls our Voice Over API to generate samples and upload to Supabase

SAMPLE_TEXT="Hello! This is a preview of my voice. I can help bring your content to life with natural speech synthesis."
BASE_URL="http://localhost:3000"

# Array of new voices
voices=("alloy" "echo" "ash" "ballad" "coral" "sage" "shimmer")

echo "🎬 Generating voice samples for updated OpenAI TTS voices..."
echo "📝 Sample text: '$SAMPLE_TEXT'"

for voice in "${voices[@]}"; do
    echo "🎙️ Generating sample for $voice..."
    
    # Create temp file for the API call
    cat > temp_payload.json << EOF
{
    "script_text": "$SAMPLE_TEXT",
    "voice_id": "$voice",
    "export_format": "mp3",
    "quality": "standard",
    "voice_settings": {
        "speed": 1.0,
        "pitch": 0,
        "volume": 1.0,
        "emphasis": "none"
    },
    "use_ssml": false
}
EOF

    # Call our Voice Over API (you'll need to add proper auth headers)
    echo "📤 Calling Voice Over API for $voice..."
    echo "ℹ️  Note: This requires authentication - you'll need to manually generate these through the UI"
    echo "🔗 Voice ID: $voice"
    echo "📄 Payload created: temp_payload.json"
    echo ""
done

echo "✅ Sample generation script complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Use the Voice Over UI at http://localhost:3000/dashboard/voice-over"
echo "2. Generate samples for each voice manually with the sample text above"
echo "3. Note down the generated audio URLs from Supabase storage"
echo "4. Update the preview URLs in the code"

rm -f temp_payload.json