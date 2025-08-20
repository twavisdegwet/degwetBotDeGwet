const axios = require('axios');

async function testDelugeMethods() {
  const baseUrl = 'http://192.168.2.124:8112';
  const password = process.env.DELUGE_PASSWORD || 'deluge';
  
  const client = axios.create({
    baseURL: baseUrl + '/',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    // First login
    console.log('Logging in...');
    const loginResponse = await client.post('json', {
      id: Date.now(),
      method: 'auth.login',
      params: [password]
    });
    
    if (loginResponse.data.error) {
      console.error('Login failed:', loginResponse.data.error);
      return;
    }
    
    console.log('Login successful:', loginResponse.data.result);
    
    // Capture cookies
    let cookies = '';
    if (loginResponse.headers['set-cookie']) {
      cookies = loginResponse.headers['set-cookie'].join('; ');
    }
    
    // Test different methods to see what's available
    const methodsToTest = [
      'daemon.get_method_list',
      'core.get_method_list', 
      'web.get_method_list',
      'system.listMethods',
      'daemon.info',
      'core.add_torrent_file',
      'core.add_torrent_url',
      'web.add_torrents',
      'web.download_torrent_from_url',
      'daemon.get_available_plugins',
      'core.get_available_plugins'
    ];
    
    for (const method of methodsToTest) {
      try {
        const response = await client.post('json', {
          id: Date.now(),
          method: method,
          params: []
        }, {
          headers: cookies ? { 'Cookie': cookies } : {}
        });
        
        if (response.data.error) {
          console.log(`❌ ${method}: ${response.data.error.message}`);
        } else {
          console.log(`✅ ${method}: Available`);
          if (method.includes('method_list') || method.includes('listMethods')) {
            console.log('  Methods:', response.data.result.slice(0, 10)); // Show first 10
          }
        }
      } catch (error) {
        console.log(`❌ ${method}: Network error`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDelugeMethods();