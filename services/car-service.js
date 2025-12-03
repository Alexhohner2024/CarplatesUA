import { scrapeUndaVin } from '../scrapers/unda-scraper.js';

/**
 * Get car information using both Unda.com.ua (for VIN) and CarPlates API (for details)
 * @param {string} input - VIN code or plate number
 * @returns {Promise<Object>} - Car information
 */
export async function getCarInfo(input) {
  console.log('[CarService] Getting car info for:', input);

  try {
    // Определяем это VIN или номер
    const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/i;
    const isVin = vinPattern.test(input);
    const plateNumber = isVin ? null : input;

    // ВРЕМЕННО ОТКЛЮЧЕНО: Поиск VIN через unda.com.ua
    // Раскомментируйте код ниже для включения поиска VIN через unda.com.ua
    let actualVin = isVin ? input : null;
    // let undaResult = null;

    // if (plateNumber) {
    //   console.log('[CarService] Getting VIN from unda.com.ua for plate:', plateNumber);
    //   undaResult = await scrapeUndaVin(plateNumber);

    //   if (undaResult.success && undaResult.vin) {
    //     actualVin = undaResult.vin;
    //     console.log('[CarService] ✅ VIN retrieved from unda.com.ua:', actualVin);
    //   } else {
    //     console.log('[CarService] ⚠️ Failed to get VIN from unda.com.ua:', undaResult.error);
    //     // Продолжаем с номером, возможно CarPlates API найдет
    //   }
    // }

    if (plateNumber) {
      console.log('[CarService] ⚠️ VIN search via unda.com.ua is temporarily disabled. Using plate number directly.');
    }

    // Теперь получаем остальные данные с CarPlates API
    console.log('[CarService] Requesting CarPlates API with:', actualVin || plateNumber);

    const response = await fetch('https://api.carplates.app/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'GvnAfeMKS3Xj4qGxpVqw3fBBjeu4MDMP',
        'x-locale': 'uk',
        'x-uuid': '67c4ed16-8622-41f7-bdc4-72195e3fef75',
        'origin': 'https://ua.carplates.app',
        'referer': 'https://ua.carplates.app/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ input: actualVin || plateNumber })
    });

    if (!response.ok) {
      console.error('[CarService] CarPlates API error:', response.status);

      // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка VIN с unda.com.ua
      // if (actualVin) {
      //   return {
      //     success: true,
      //     vin: actualVin,
      //     plate: plateNumber,
      //     vinSource: 'unda.com.ua',
      //     message: 'VIN получен с unda.com.ua, но дополнительные данные недоступны'
      //   };
      // }

      return {
        success: false,
        message: 'Не удалось получить данные из CarPlates API'
      };
    }

    const data = await response.json();
    console.log('[CarService] CarPlates API response received');

    if (data.error) {
      // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка VIN с unda.com.ua
      // if (actualVin) {
      //   return {
      //     success: true,
      //     vin: actualVin,
      //     plate: plateNumber,
      //     vinSource: 'unda.com.ua',
      //     message: 'VIN получен с unda.com.ua'
      //   };
      // }

      return {
        success: false,
        message: 'Автомобиль не найден в базе данных'
      };
    }

    // Извлекаем основную информацию из CarPlates
    const carInfo = {
      success: true,
      plate: data.plate || plateNumber,
      plate_en: data.plate_en,
      vin: actualVin || data.vin, // ВРЕМЕННО: VIN только из CarPlates API (unda отключен)
      vinSource: 'carplates.app', // ВРЕМЕННО: unda отключен
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
      region: data.region || 'Не указано',
      settlement: data.settlement || 'Не указано'
    };

    // Извлекаем детали из unicards
    if (data.unicards && data.unicards.length > 0) {
      const govReg = data.unicards.find(card => card.id === 'gov_registration');
      const vinDecode = data.unicards.find(card => card.id === 'vin_decode');

      if (govReg) {
        carInfo.brand = govReg.brand;
        carInfo.model = govReg.model;
        carInfo.year = govReg.make_year;

        // Если VIN не был получен с unda, пытаемся взять из CarPlates
        if (!carInfo.vin && govReg.vin) {
          carInfo.vin = govReg.vin;
          carInfo.vinSource = 'carplates.app';
        }

        // Извлекаем информацию из properties_horizontal
        if (govReg.properties_horizontal) {
          govReg.properties_horizontal.forEach(prop => {
            switch (prop.label) {
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

          // Если все еще нет VIN, пытаемся из properties (может быть частично скрыт)
          if (!carInfo.vin) {
            const vinProp = govReg.properties.find(p => p.label === 'VIN');
            if (vinProp && vinProp.value) {
              carInfo.vin = vinProp.value.replace(/<.*$/g, '');
              carInfo.vinSource = 'carplates.app (partial)';
            }
          }
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

    console.log('[CarService] ✅ Successfully retrieved data. VIN source:', carInfo.vinSource);

    return carInfo;

  } catch (error) {
    console.error('[CarService] Error:', error);
    return {
      success: false,
      error: 'Internal error',
      message: error.message
    };
  }
}

/**
 * Get VIN only from Unda.com.ua
 * @param {string} plateNumber - Plate number
 * @returns {Promise<Object>} - Result with VIN
 */
export async function getVinFromUnda(plateNumber) {
  console.log('[CarService] Getting VIN from Unda for:', plateNumber);
  return await scrapeUndaVin(plateNumber);
}
