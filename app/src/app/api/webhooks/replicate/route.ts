import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { 
  setPredictionUpdate, 
  getPredictionCallback, 
  removePredictionCallback 
} from '@/lib/replicate-webhook';

export async function POST(request: NextRequest) {
  try {
    // Get the webhook payload
    const payload = await request.text();
    const prediction = JSON.parse(payload);
    
    // Verify webhook signature (optional but recommended)
    const headersList = await headers();
    const signature = headersList.get('replicate-signature');
    if (signature && !verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    console.log(`📨 Webhook received for prediction ${prediction.id}:`, {
      status: prediction.status,
      model: prediction.model,
      hasOutput: !!prediction.output
    });
    
    // Store the latest prediction state
    setPredictionUpdate(prediction.id, prediction);
    
    // Handle different prediction statuses
    await handlePredictionUpdate(prediction);
    
    // Execute any registered callbacks
    const callbackInfo = getPredictionCallback(prediction.id);
    if (callbackInfo) {
      try {
        await callbackInfo.callback(prediction);
        
        // Clean up completed predictions
        if (['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
          removePredictionCallback(prediction.id);
        }
      } catch (error) {
        console.error('Callback execution failed:', error);
      }
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handlePredictionUpdate(prediction: Record<string, unknown>) {
  switch (prediction.status) {
    case 'starting':
      console.log(`🚀 Prediction ${prediction.id} started`);
      break;
      
    case 'processing':
      console.log(`⚙️ Prediction ${prediction.id} processing...`);
      break;
      
    case 'succeeded':
      console.log(`✅ Prediction ${prediction.id} completed successfully`);
      // Handle successful completion
      await handleSuccessfulPrediction(prediction);
      break;
      
    case 'failed':
      console.log(`❌ Prediction ${prediction.id} failed:`, prediction.error);
      // Handle failure
      await handleFailedPrediction(prediction);
      break;
      
    case 'canceled':
      console.log(`🚫 Prediction ${prediction.id} was canceled`);
      break;
  }
}

async function handleSuccessfulPrediction(prediction: Record<string, unknown>) {
  // Process the output based on model type
  if (prediction.output) {
    // For image generation models
    if (Array.isArray(prediction.output)) {
      console.log(`🖼️ Generated ${prediction.output.length} images`);
    } else if (typeof prediction.output === 'string' && prediction.output.startsWith('http')) {
      console.log(`🖼️ Generated image: ${prediction.output}`);
    }
    
    // Store in database, send notifications, etc.
    await storePredictionResult();
  }
}

async function handleFailedPrediction(prediction: Record<string, unknown>) {
  // Log error details
  console.error('Prediction failed:', {
    id: prediction.id,
    model: prediction.model,
    error: prediction.error,
    logs: prediction.logs
  });
  
  // Notify users, store error logs, etc.
  await storeErrorLog();
}

async function storePredictionResult() {
  // Store in your database
  // await db.predictions.create({
  //   id: prediction.id,
  //   model: prediction.model,
  //   status: prediction.status,
  //   output: prediction.output,
  //   completed_at: prediction.completed_at
  // });
}

async function storeErrorLog() {
  // Store error information
  // await db.errorLogs.create({
  //   prediction_id: prediction.id,
  //   error: prediction.error,
  //   logs: prediction.logs,
  //   created_at: new Date()
  // });
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  // Verify using your webhook secret
  const expectedSignature = crypto
    .createHmac('sha256', process.env.REPLICATE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}

