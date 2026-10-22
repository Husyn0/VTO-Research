Step 1: Create the project and install dependencies
```bash

npm create vite@latest virtual-tryon -- --template react
cd virtual-tryon
npm install
npm install @mediapipe/tasks-vision
```
Download the Face Landmarker model into the public directory:
```bash

mkdir -p public/models public/products
curl -L -o public/models/face_landmarker.task \
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  ```