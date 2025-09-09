export default async function handler(req, res) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { vin } = req.body;

    if (!vin) {
      return res.status(400).json({ error: 'VIN code is required' });
    }

    console.log('Поиск информации для VIN:', vin);

    // Запрос к CarPlates API с Google OAuth токеном
    const response = await fetch('https://api.carplates.app/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.GOOGLE_AUTH_TOKEN,
        'Cookie': `COMPASS=${process.env.COMPASS_COOKIE}`,
        'x-api-key': 'GvnAfeMKS3Xj4qGxpVqw3fBBjeu4MDMP',
        'x-locale': 'uk',
        'x-uuid': '67c4ed16-8622-41f7-bdc4-72195e3fef75',
        'origin': 'https://ua.carplates.app',
        'referer': 'https://ua.carplates.app/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ input: vin })
    });

    if (!response.ok) {
      console.error('CarPlates API error:', response.status);
      return res.status(response.status).json({ 
        error: 'Failed to fetch car data',
        status: response.status 
      });
    }

    const data = await response.json();
    console.log('Full CarPlates API response:', JSON.stringify(data, null, 2));

    if (data.error) {
      return res.status(200).json({ 
        success: false, 
        message: 'Автомобіль не знайдено в базі даних' 
      });
    }

    // Извлекаем основную информацию
    const carInfo = {
      success: true,
      plate: data.plate,
      plate_en: data.plate_en,
      vin: data.vin,
      color: data.color,
      brand: null,
      model: null,
      year: null,
      engine: null,
      fuel: null,
      type: null,
      mass: null,
      max_mass: null,
      category: null,
      region: data.region || 'Не вказано',
      settlement: data.settlement || 'Не вказано'
    };

    // Извлекаем детали из unicards
    if (data.unicards && data.unicards.length > 0) {
      const govReg = data.unicards.find(card => card.id === 'gov_registration');
      const vinDecode = data.unicards.find(card => card.id === 'vin_decode');

      if (govReg) {
        carInfo.brand = govReg.brand;
        carInfo.model = govReg.model;
        carInfo.year = govReg.make_year;
        
        // Извлекаем VIN из gov_registration если не был найден в основных данных
        if (!carInfo.vin && govReg.vin) {
          carInfo.vin = govReg.vin;
        }

        // Извлекаем информацию из properties_horizontal
        if (govReg.properties_horizontal) {
          govReg.properties_horizontal.forEach(prop => {
            switch(prop.label) {
              case 'Паливо':
                carInfo.fuel = prop.value;
                break;
              case 'Об\'єм двигуна':
                carInfo.engine = prop.value;
                break;
              case 'Тип':
                carInfo.type = prop.value;
                break;
              case 'Маса/Макс. маса':
                // Разделяем массу на две части
                const massValues = prop.value.split(' / ');
                if (massValues.length === 2) {
                  carInfo.mass = massValues[0];
                  carInfo.max_mass = massValues[1];
                } else {
                  carInfo.mass = prop.value;
                }
                break;
              case 'Категорія/Кузов':
                carInfo.category = prop.value;
                break;
            }
          });
        }

        // Извлекаем регион из properties
        if (govReg.properties) {
          const regionProp = govReg.properties.find(p => p.label === 'Регіон');
          if (regionProp) carInfo.region = regionProp.value;
        }
      }

      if (vinDecode) {
        if (!carInfo.brand) carInfo.brand = vinDecode.brand;
        if (!carInfo.model) carInfo.model = vinDecode.model;
        if (!carInfo.year) carInfo.year = vinDecode.make_year;
      }

      // Извлекаем населенный пункт из owner карточки
      const owner = data.unicards.find(card => card.id === 'owner');
      if (owner && owner.location && owner.location.address) {
        const address = owner.location.address;
        const lines = address.split('\n');
        const cityMatch = lines[lines.length - 1].trim();
        if (cityMatch) {
          carInfo.settlement = cityMatch;
        }
      }
    }

    return res.status(200).json(carInfo);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}