import * as cornerstone from "cornerstone-core";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import dicomParser from "dicom-parser";

// Налаштування Cornerstone
let initialized = false;
function initDicom() {
  if (initialized) return;
  
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    startWebWorkersOnDemand: true,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: false,
        usePDFJS: false
      }
    }
  });

  initialized = true;
}

// Теги DICOM
const TAGS = {
  PatientName: "x00100010",
  PatientAge: "x00101010",
  Modality: "x00080060",
  SeriesDescription: "x0008103e",
  SliceLocation: "x00201041",
  StudyDate: "x00080020"
};

/**
 * Читає DICOM файл, рендерить його в Data URL (JPEG) і дістає метадані.
 * @param {File} file 
 * @returns {Promise<{ dataUrl: string, meta: any }>}
 */
export async function processDicomFile(file) {
  initDicom();

  return new Promise(async (resolve, reject) => {
    try {
      // Додаємо файл в менеджер локальних файлів Cornerstone
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
      
      // Завантажуємо зображення
      const image = await cornerstone.loadImage(imageId);
      
      // Створюємо тимчасовий канвас для рендерингу пікселів
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      
      // Ініціалізуємо і рендеримо
      cornerstone.enable(canvas);
      cornerstone.displayImage(canvas, image);
      
      // Очікуємо застосування стилів і рендерингу (іноді потребує одного тіку)
      setTimeout(() => {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        
        // Витягуємо метадані
        const ds = image.data;
        const meta = {};
        
        if (ds) {
          const getName = (tag) => {
             const str = ds.string(tag);
             if (!str) return null;
             return str.replace(/\\^/g, " ").trim();
          };
          
          meta.patientName = getName(TAGS.PatientName);
          meta.age = getName(TAGS.PatientAge);
          meta.modality = getName(TAGS.Modality);
          meta.series = getName(TAGS.SeriesDescription);
          meta.sliceLoc = getName(TAGS.SliceLocation);
        }
        
        // Звільняємо пам'ять
        cornerstone.disable(canvas);
        cornerstoneWADOImageLoader.wadouri.fileManager.remove(imageId);
        
        resolve({ dataUrl, meta });
      }, 50);

    } catch (e) {
      reject(e);
    }
  });
}
