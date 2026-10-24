const DATABASE_NAME = "virtual-tryon-products";
const DATABASE_VERSION = 1;
const STORE_NAME = "products";

let databasePromise;

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support local product storage."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Could not open local product storage."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Local product storage is blocked by another app tab."));
    };
  });

  return databasePromise;
}

function runTransaction(mode, operation) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        let result;

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          reject(request.error || new Error("Local product storage request failed."));
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => {
          reject(transaction.error || new Error("Could not update local product storage."));
        };
        transaction.onabort = () => {
          reject(transaction.error || new Error("Local product storage update was cancelled."));
        };
      })
  );
}

export function getUserProducts() {
  return runTransaction("readonly", (store) => store.getAll());
}

export function saveUserProduct(product) {
  return runTransaction("readwrite", (store) => store.put(product));
}

export function deleteUserProduct(id) {
  return runTransaction("readwrite", (store) => store.delete(id));
}
