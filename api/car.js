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

    // Запрос к CarPlates API
    const response = await fetch('https://api.carplates.app/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.AUTH_TOKEN,
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
      mass: null,
      region: data.region || 'Не вказано',
      settlement: data.settlement || 'Не вказано',
      registration_date: null
    };

    // Извлекаем детали из unicards
    if (data.unicards && data.unicards.length > 0) {
      const govReg = data.unicards.find(card => card.id === 'gov_registration');
      const vinDecode = data.unicards.find(card => card.id === 'vin_decode');
      const owner = data.unicards.find(card => card.id === 'owner');

      if (govReg) {
        carInfo.brand = govReg.brand;
        carInfo.model = govReg.model;
        carInfo.year = govReg.make_year;

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
              case 'Маса/Макс. маса':
                carInfo.mass = prop.value;
                break;
            }
          });
        }

        // Извлекаем регион из properties
        if (govReg.properties) {
          const regionProp = govReg.properties.find(p => p.label === 'Регіон');
          if (regionProp) carInfo.region = regionProp.value;

          const dateProp = govReg.properties.find(p => p.label === 'Дата першої реєстрації');
          if (dateProp && dateProp.value !== '$$*#-**-*$') {
            carInfo.registration_date = dateProp.value;
          }
        }
      }

      // Извлекаем населенный пункт из owner карточки
      if (owner && owner.location && owner.location.address) {
        const address = owner.location.address;
        // Извлекаем город из первой строки (убираем префикс М.)
        const cityMatch = address.split('\n')[0].replace('М.', '').trim();
        if (cityMatch) {
          carInfo.settlement = cityMatch;
        }
      }

      // Извлекаем населенный пункт из owner карточки
      const owner = data.unicards.find(card => card.id === 'owner');
      if (owner && owner.location && owner.location.address) {
        const address = owner.location.address;
        // Извлекаем город из первой строки (убираем префикс М.)
        const cityMatch = address.split('\n')[0].replace('М.', '').trim();
        if (cityMatch) {
          carInfo.settlement = cityMatch;
        }
      }

      if (vinDecode) {
        if (!carInfo.brand) carInfo.brand = vinDecode.brand;
        if (!carInfo.model) carInfo.model = vinDecode.model;
        if (!carInfo.year) carInfo.year = vinDecode.make_year;
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