import axios from 'axios';

async function testDistill() {
  try {
    const response = await axios.post('http://localhost:3160/v1/memory/distill', {
      seed: {
        query: 'How does the STAR algorithm handle temporal decay?'
      },
      radius: 2,
      max_radius: 5,
      output_format: 'json',
      auto_save: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testDistill();
