const DB_NAME = "mri-insight-db";
const DB_VER = 5;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("refs")) db.createObjectStore("refs");
      if (!db.objectStoreNames.contains("studies")) db.createObjectStore("studies");
      if (!db.objectStoreNames.contains("corrections")) db.createObjectStore("corrections");
      if (!db.objectStoreNames.contains("archive")) db.createObjectStore("archive");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function dbPut(store, key, value) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    const reqK = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => { reqK.onsuccess = () => { const obj = {}; reqK.result.forEach((k, i) => { obj[k] = req.result[i]; }); resolve(obj); }; };
    req.onerror = () => resolve({});
  });
}
