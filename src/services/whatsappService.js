import axios from 'axios';

import { config } from 'dotenv';

config();

class WhatsAppService {
  constructor() {
    if (!process.env.META_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('WhatsApp service: Missing required environment variables');
    }

    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.version = 'v17.0';
    this.baseURL = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}`;
  }

  async sendTextMessage(to, text) {
    try {
      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('WhatsApp API Error:', error.response?.data || error);
      throw error;
    }
  }

  async sendHospitalList(to, hospitals) {
    try {
      const sections = [{
        title: 'Available Hospitals',
        rows: hospitals.map(hospital => ({
          id: hospital._id.toString(),
          title: hospital.name.substring(0, 24),
          description: `Distance: ${hospital.location.distance || 'N/A'}`
        }))
      }];

      const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: 'Nearby Hospitals'
          },
          body: {
            text: 'Select a hospital to book a bed:'
          },
          footer: {
            text: 'Tap "View Hospitals" to see options'
          },
          action: {
            button: 'View Hospitals',
            sections: sections
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}/messages`,
        message,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending hospital list:', error.response?.data || error);
      await this.sendTextMessage(
        to, 
        'Available Hospitals:\n\n' + 
        hospitals.map(h => `- ${h.name} (Distance: ${h.location.distance || 'N/A'})`).join('\n')
      );
      throw error;
    }
  }

  async sendAmbulanceQuestion(to, hospitalName) {
    try {
      const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `You selected ${hospitalName}. Do you need an ambulance?`
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'ambulance_yes',
                  title: 'Yes'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'ambulance_no',
                  title: 'No'
                }
              }
            ]
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}/messages`,
        message,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending ambulance question:', error.response?.data || error);
      await this.sendTextMessage(
        to,
        `You selected ${hospitalName}. Do you need an ambulance? Reply YES or NO.`
      );
      throw error;
    }
  }

  async sendLocationRequest(to) {
    try {
      const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'location_request_message',
          body: {
            text: "Please share your location to find nearby hospitals"
          },
          action: {
            name: "send_location"
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}/messages`,
        message,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending location request:', error.response?.data || error);
      throw error;
    }
  }
}

export default new WhatsAppService(); 