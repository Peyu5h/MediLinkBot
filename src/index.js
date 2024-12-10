import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { config } from 'dotenv';
import whatsappService from './services/whatsappService.js';
import conversationService from './services/conversationService.js';
import axios from 'axios';

config();

const checkEnvironment = () => {
  const required = [
    'META_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WEBHOOK_VERIFY_TOKEN',
    'MONGODB_URI'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
};

checkEnvironment();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/webhook', (req, res) => {
  try {
    console.log('Received webhook verification request:', req.query);
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!mode || !token) {
      console.log('Missing mode or token');
      return res.sendStatus(403);
    }

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return res.status(200).send(challenge);
    }

    console.log('Verification failed. Token mismatch.');
    return res.sendStatus(403);
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.sendStatus(500);
  }
});

app.post('/webhook', async (req, res) => {
    try {
      console.log('=================== WEBHOOK REQUEST START ===================');
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Raw Body:', JSON.stringify(req.body, null, 2));
      
      // Check if this is a WhatsApp status update
      if (req.body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        console.log('Received status update - ignoring');
        return res.sendStatus(200);
      }
  
      const change = req.body.entry?.[0]?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      
      console.log('Extracted change:', JSON.stringify(change, null, 2));
      console.log('Extracted message:', JSON.stringify(message, null, 2));
      
      if (!message) {
        console.log('No valid message found in webhook');
        return res.sendStatus(200);
      }
  
      const from = message.from;
      let messageContent;
  
      if (message.type === 'text') {
        messageContent = message.text.body;
        console.log('Received text message:', messageContent);
      } else if (message.type === 'interactive') {
        messageContent = {
          type: 'interactive',
          interactiveType: message.interactive.type,
          listReply: message.interactive.list_reply,
          buttonReply: message.interactive.button_reply
        };
        console.log('Received interactive message:', messageContent);
      } else if (message.type === 'location') {
        messageContent = {
          type: 'location',
          latitude: message.location.latitude,
          longitude: message.location.longitude
        };
        console.log('Received location message:', messageContent);
      }
  
      console.log('About to handle message for:', from);
      await conversationService.handleMessage(from, messageContent);
      console.log('Message handled successfully');
      
      return res.sendStatus(200);
    } catch (error) {
      console.error('Webhook error:', error.stack);
      return res.sendStatus(500);
    } finally {
      console.log('=================== WEBHOOK REQUEST END ===================');
    }
  });

app.get('/test-whatsapp', async (req, res) => {
  try {
    await whatsappService.sendTextMessage('918928937191', 'Test message');
    res.send('Message sent successfully');
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).send(error.message);
  }
});




app.get('/test-all', async (req, res) => {
  try {
    console.log('Testing WhatsApp connectivity...');
    
    const basicMessage = await whatsappService.sendTextMessage(
      '918928937191', 
      'Testing basic message'
    );
    console.log('Basic message sent:', basicMessage);
    
    const medlinkResponse = await axios.post('YOUR_MEDLINK_API_ENDPOINT', {
      // Add your required payload here
    });
    const hospitals = medlinkResponse.data; // Adjust based on actual response structure
    
    const hospitalList = await whatsappService.sendHospitalList(
      '918928937191', 
      hospitals
    );
    console.log('Hospital list sent:', hospitalList);
    
    res.json({
      success: true,
      basicMessage,
      hospitalList
    });
  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

app.get('/test-flow', async (req, res) => {
  try {
    const results = {
      steps: [],
      success: false
    };

    // Step 1: Test MongoDB Connection
    try {
      await mongoose.connection.db.admin().ping();
      results.steps.push({ name: 'MongoDB Connection', status: 'success' });
    } catch (error) {
      results.steps.push({ 
        name: 'MongoDB Connection', 
        status: 'failed', 
        error: error.message 
      });
      throw error;
    }

    // Step 2: Check if Medlink API is accessible
    try {
      const medlinkResponse = await axios.post('YOUR_MEDLINK_API_ENDPOINT', {
        // Add your required payload here
      });
      const hospitals = medlinkResponse.data; // Adjust based on actual response structure
      if (!hospitals || !hospitals.length) {
        throw new Error('No hospitals returned from Medlink API');
      }
      results.steps.push({ 
        name: 'Medlink API Check', 
        status: 'success', 
        count: hospitals.length 
      });
    } catch (error) {
      results.steps.push({ 
        name: 'Medlink API Check', 
        status: 'failed', 
        error: error.message 
      });
      throw error;
    }

    // Step 3: Test WhatsApp Basic Message
    const testNumber = '918928937191'; // Replace with your test number
    const basicMessage = await whatsappService.sendTextMessage(
      testNumber,
      'Test message from system check'
    );
    results.steps.push({ 
      name: 'WhatsApp Basic Message', 
      status: 'success', 
      response: basicMessage 
    });

    // Step 4: Test Hospital List Message
    const hospitals = await Hospital.find().limit(3);
    const hospitalList = await whatsappService.sendHospitalList(
      testNumber,
      hospitals
    );
    results.steps.push({ 
      name: 'WhatsApp Hospital List', 
      status: 'success', 
      response: hospitalList 
    });

    results.success = true;
    res.json(results);

  } catch (error) {
    console.error('Test flow failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      steps: results?.steps || []
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});