const { default: axios } = require('axios');
const { getAccessToken } = require('./src/services/api.service');

async function test() {
  const token = await getAccessToken();
  const response = await axios.post(
    'https://eliteedition.unicommerce.com/services/rest/v1/product/itemType/search',
    { },
    {
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  console.log(JSON.stringify(response.data.elements[0], null, 2));
}
test();
