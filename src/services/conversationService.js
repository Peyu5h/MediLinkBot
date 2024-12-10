import whatsappService from './whatsappService.js';
import axios from 'axios';

class ConversationService {
  constructor() {
    this.userStates = new Map();
  }

  async handleMessage(from, messageContent) {
    try {
      console.log('Processing message:', { from, messageContent });
  
      if (typeof messageContent === 'string') {
        if (messageContent.toLowerCase() === 'book hospital') {
          await whatsappService.sendLocationRequest(from);
          this.userStates.set(from, {
            step: 'AWAITING_LOCATION'
          });
        } else {
          await whatsappService.sendTextMessage(
            from,
            'Welcome to Medlink! Send "book hospital" to start booking.'
          );
        }
      }
      else if (messageContent?.type === 'location') {
        const location = {
          lat: messageContent.latitude,
          long: messageContent.longitude
        };
        console.log('Received location:', location);
        
        this.userStates.set(from, {
          step: 'AWAITING_HOSPITAL_SELECTION',
          location: {
            latitude: messageContent.latitude,
            longitude: messageContent.longitude
          }
        });
        
        try {
          const response = await axios.post(
            'https://medlink-mocha.vercel.app/api/getNearby',
            location
          );
          
          const hospitals = response.data.hospitals;
          if (!hospitals || hospitals.length === 0) {
            await whatsappService.sendTextMessage(from, 'No hospitals found in your area. Please try again later.');
            return;
          }
          await whatsappService.sendHospitalList(from, hospitals);
        } catch (error) {
          console.error('Error fetching hospitals:', error);
          await whatsappService.sendTextMessage(from, 'Unable to fetch hospitals at the moment. Please try again later.');
        }
      }
      else if (messageContent?.type === 'interactive') {
        if (messageContent.listReply) {
          const selectedHospitalId = messageContent.listReply.id;
          const userState = this.userStates.get(from);
          
          if (!userState?.location) {
            await whatsappService.sendTextMessage(from, 'Please share your location first by sending "book hospital"');
            return;
          }

          const response = await axios.post(
            'https://medlink-mocha.vercel.app/api/getNearby',
            {
              lat: userState.location.latitude,
              long: userState.location.longitude
            }
          );
          
          const selectedHospital = response.data.hospitals.find(h => h._id === selectedHospitalId);
          if (selectedHospital) {
            await whatsappService.sendAmbulanceQuestion(from, selectedHospital.name);
            this.userStates.set(from, {
              ...userState,
              step: 'AMBULANCE_CONFIRMATION',
              hospitalId: selectedHospitalId,
              hospitalName: selectedHospital.name
            });
          }
        } else if (messageContent.buttonReply) {
          const userState = this.userStates.get(from);
          if (userState?.step === 'AMBULANCE_CONFIRMATION') {
            const requiresAmbulance = messageContent.buttonReply.id === 'ambulance_yes';
            
            // Send confirmation message with timing warning
            await whatsappService.sendTextMessage(
              from,
              `Booking confirmed at ${userState.hospitalName}! Please arrive on time. Your slot will be discarded after 1 hour.`
            );
            this.userStates.delete(from);
          }
        }
      }
    } catch (error) {
      console.error('Message handling error:', error);
      await whatsappService.sendTextMessage(
        from,
        'Sorry, there was an error. Please try again.'
      );
    }
  }
}

export default new ConversationService(); 