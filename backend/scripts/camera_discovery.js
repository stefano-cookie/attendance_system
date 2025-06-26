const axios = require('axios');
const { spawn } = require('child_process');
const os = require('os');

class CameraDiscovery {
  constructor() {
    this.foundCameras = [];
    this.commonPorts = [80, 8080, 8000, 554, 8554, 443, 8443];
    this.timeout = 3000;
  }

  getLocalNetworkRanges() {
    const interfaces = os.networkInterfaces();
    const ranges = [];

    for (const interfaceName in interfaces) {
      const iface = interfaces[interfaceName];
      for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal && config.address.startsWith('192.168')) {
          const parts = config.address.split('.');
          const networkBase = `${parts[0]}.${parts[1]}.${parts[2]}`;
          ranges.push(networkBase);
        }
      }
    }

    return [...new Set(ranges)];
  }

  async scanNetwork(networkBase = '192.168.1') {
    console.log(`🔍 Scansione rete ${networkBase}.0/24...`);
    const activeHosts = [];

    const promises = [];
    for (let i = 1; i < 255; i++) {
      const ip = `${networkBase}.${i}`;
      promises.push(this.pingHost(ip));
    }

    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        activeHosts.push(`${networkBase}.${index + 1}`);
      }
    });

    console.log(`✅ Trovati ${activeHosts.length} host attivi`);
    return activeHosts;
  }

  pingHost(ip) {
    return new Promise((resolve) => {
      const ping = spawn('ping', ['-c', '1', '-W', '1000', ip]);
      
      ping.on('close', (code) => {
        resolve(code === 0);
      });

      ping.on('error', () => {
        resolve(false);
      });
    });
  }

  async testCamera(ip) {
    console.log(`🎥 Testing camera ${ip}...`);
    
    for (const port of this.commonPorts) {
      try {
        const cameraInfo = await this.probeCamera(ip, port);
        if (cameraInfo) {
          console.log(`✅ Camera trovata: ${ip}:${port}`);
          return {
            ip,
            port,
            ...cameraInfo
          };
        }
      } catch (error) {
      }
    }

    return null;
  }

  async probeCamera(ip, port) {
    const baseUrl = `http://${ip}:${port}`;
    
    try {
      const response = await axios.get(baseUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'CameraDiscovery/1.0'
        }
      });

      const info = {
        manufacturer: 'Unknown',
        model: 'Unknown',
        firmware: 'Unknown',
        resolution: 'Unknown',
        type: 'http',
        webInterface: true,
        onvifSupport: false
      };

      const server = response.headers.server || '';
      const contentType = response.headers['content-type'] || '';
      
      if (server.toLowerCase().includes('imou')) {
        info.manufacturer = 'IMOU';
        info.model = 'IMOU Camera';
      } else if (server.toLowerCase().includes('hikvision')) {
        info.manufacturer = 'Hikvision';
        info.model = 'Hikvision Camera';
      } else if (server.toLowerCase().includes('dahua')) {
        info.manufacturer = 'Dahua';
        info.model = 'Dahua Camera';
      } else if (server.toLowerCase().includes('axis')) {
        info.manufacturer = 'Axis';
        info.model = 'Axis Camera';
      }

      const onvifSupport = await this.testOnvif(ip);
      if (onvifSupport) {
        info.onvifSupport = true;
        info.type = 'onvif';
      }

      const detailedInfo = await this.getDetailedInfo(ip, port);
      if (detailedInfo) {
        Object.assign(info, detailedInfo);
      }

      return info;

    } catch (error) {
      if (error.response && error.response.status === 401) {
        return {
          manufacturer: 'Unknown',
          model: 'IP Camera (Auth Required)',
          firmware: 'Unknown',
          resolution: 'Unknown',
          type: 'http',
          webInterface: true,
          onvifSupport: await this.testOnvif(ip),
          authRequired: true
        };
      }
      
      throw error;
    }
  }

  async testOnvif(ip) {
    try {
      const onvifRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsdl="http://www.onvif.org/ver10/device/wsdl">
  <soap:Header/>
  <soap:Body>
    <wsdl:GetCapabilities>
      <wsdl:Category>All</wsdl:Category>
    </wsdl:GetCapabilities>
  </soap:Body>
</soap:Envelope>`;

      const response = await axios.post(`http://${ip}/onvif/device_service`, onvifRequest, {
        timeout: 2000,
        headers: {
          'Content-Type': 'application/soap+xml',
          'SOAPAction': '"http://www.onvif.org/ver10/device/wsdl/GetCapabilities"'
        }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getDetailedInfo(ip, port) {
    const endpoints = [
      '/cgi-bin/deviceInfo.cgi',
      '/api/v1/deviceInfo',
      '/ISAPI/System/deviceInfo',
      '/config/deviceInfo'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`http://${ip}:${port}${endpoint}`, {
          timeout: 2000
        });

        if (response.data) {
          return this.parseDeviceInfo(response.data);
        }
      } catch (error) {
      }
    }

    return null;
  }

  parseDeviceInfo(data) {
    const info = {};

    if (typeof data === 'string') {
      if (data.includes('DeviceName=')) {
        const nameMatch = data.match(/DeviceName=([^\r\n]+)/);
        if (nameMatch) info.model = nameMatch[1];
      }
      
      if (data.includes('FirmwareVersion=')) {
        const firmwareMatch = data.match(/FirmwareVersion=([^\r\n]+)/);
        if (firmwareMatch) info.firmware = firmwareMatch[1];
      }
    } else if (typeof data === 'object') {
      info.model = data.deviceName || data.model || info.model;
      info.firmware = data.firmwareVersion || data.version || info.firmware;
      info.manufacturer = data.manufacturer || data.vendor || info.manufacturer;
    }

    return info;
  }

  async discoverCameras(specificNetwork = null) {
    console.log('🚀 Avvio Camera IP Discovery...');
    
    this.foundCameras = [];
    
    try {
      let networks = specificNetwork ? [specificNetwork] : this.getLocalNetworkRanges();
      
      if (networks.length === 0) {
        networks = ['192.168.1'];
      }

      console.log(`📡 Scansione reti: ${networks.join(', ')}`);

      for (const network of networks) {
        console.log(`\n🔍 Scansione rete ${network}.0/24...`);
        
        const activeHosts = await this.scanNetwork(network);
        
        console.log(`🎯 Test ${activeHosts.length} host attivi per camere IP...`);
        
        const cameraPromises = activeHosts.map(ip => this.testCamera(ip));
        const cameraResults = await Promise.allSettled(cameraPromises);
        
        cameraResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            this.foundCameras.push(result.value);
          }
        });
      }

      console.log(`\n✅ Discovery completato! Trovate ${this.foundCameras.length} camere IP:`);
      
      this.foundCameras.forEach((camera, index) => {
        console.log(`${index + 1}. ${camera.ip}:${camera.port} - ${camera.manufacturer} ${camera.model}`);
        console.log(`   Type: ${camera.type}, ONVIF: ${camera.onvifSupport}, Auth: ${camera.authRequired || false}`);
      });

      return this.foundCameras;

    } catch (error) {
      console.error('❌ Errore durante discovery:', error);
      return [];
    }
  }

  exportResults() {
    return {
      timestamp: new Date().toISOString(),
      totalFound: this.foundCameras.length,
      cameras: this.foundCameras.map(camera => ({
        ip: camera.ip,
        port: camera.port,
        manufacturer: camera.manufacturer,
        model: camera.model,
        firmware: camera.firmware,
        type: camera.type,
        onvifSupport: camera.onvifSupport,
        authRequired: camera.authRequired || false,
        webInterface: camera.webInterface || false,
        suggested_name: `${camera.manufacturer} ${camera.model} (${camera.ip})`,
        suggested_username: 'admin',
        confidence: camera.manufacturer !== 'Unknown' ? 'high' : 'medium'
      }))
    };
  }
}

async function discoverCamerasOnNetwork(network = null) {
  const discovery = new CameraDiscovery();
  const cameras = await discovery.discoverCameras(network);
  return discovery.exportResults();
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const network = args[0] || null;
  
  console.log('🎥 Camera IP Discovery Tool');
  console.log('===========================\n');
  
  discoverCamerasOnNetwork(network)
    .then(results => {
      console.log('\n📋 Risultati finali:');
      console.log(JSON.stringify(results, null, 2));
      
      if (results.cameras.length > 0) {
        console.log('\n💡 Suggerimenti:');
        console.log('- Testa la connessione a ciascuna camera');
        console.log('- Verifica le credenziali di accesso');
        console.log('- Configura le camere nel sistema');
      }
    })
    .catch(error => {
      console.error('❌ Errore:', error);
      process.exit(1);
    });
}

module.exports = { CameraDiscovery, discoverCamerasOnNetwork };