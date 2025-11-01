// Test script to verify signature generation
const axios = require('axios');

async function testSignature() {
  try {
    // Get all requests
    const response = await axios.get('http://localhost:3000/admin/requests?status=approved', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoiYWRtaW4iLCJpYXQiOjE3MzA1MDgxMjQsImV4cCI6MTczMDUxMTcyNH0.vS9X4vGCMhxhLw4Z2lQvZCPBOx4nj9EhSJzKQjxGbQE'
      }
    });
    
    console.log('Approved requests:', response.data.data.length);
    
    if (response.data.data.length > 0) {
      const firstRequest = response.data.data[0];
      console.log('\nFirst approved request:');
      console.log('ID:', firstRequest.id);
      console.log('VoterID:', firstRequest.voterId);
      console.log('Status:', firstRequest.status);
      
      // Get details to see signature
      const detailsResponse = await axios.get(`http://localhost:3000/admin/requests/${firstRequest.id}`, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoiYWRtaW4iLCJpYXQiOjE3MzA1MDgxMjQsImV4cCI6MTczMDUxMTcyNH0.vS9X4vGCMhxhLw4Z2lQvZCPBOx4nj9EhSJzKQjxGbQE'
        }
      });
      
      console.log('\nSignature data:');
      console.log('R8x:', detailsResponse.data.signature?.signatureR8x);
      console.log('R8y:', detailsResponse.data.signature?.signatureR8y);
      console.log('S:', detailsResponse.data.signature?.signatureS);
      console.log('\nPublic Key:');
      console.log('Ax:', detailsResponse.data.signature?.publicKeyX);
      console.log('Ay:', detailsResponse.data.signature?.publicKeyY);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSignature();
