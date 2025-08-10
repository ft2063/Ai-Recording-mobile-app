
# AI Inference App – Voice Transcription & Analysis

This repository contains a **full-stack AI-powered voice transcription application**.  
It allows users to **record speech via a mobile app**, send it to a backend server, and receive **transcribed text** using AI-based speech-to-text models.




## Getting Started


### Clone the Repository

```bash
git clone https://github.com/<your-username>/AI-inference-app.git
cd AI-inference-app
````

### Install Dependencies

#### Frontend (Expo app)

```bash
cd expo-voice-demo
npm install
```

#### Backend (Node.js server)

```bash
cd ../transcribe-server
npm install
```

---

## ▶️ Running the App

### Start the Backend

```bash
cd transcribe-server
node index.js
```

The server will run on **[http://localhost:3000](http://localhost:3000)** by default.

### Start the Frontend

```bash
cd ../expo-voice-demo
npx expo start
```

Scan the QR code using **Expo Go** on your phone.
Open the Expo Go app on your phone.

### Using the app
Tap the mic button to record.

Tap again to stop — the app uploads audio to TRANSCRIBE_URL and shows the transcript.

Tap Save to Library to extract key points + store locally on the server.

Tap the Library icon to view all entries, search semantically, or ask questions (RAG).


---

## ⚙️ Environment Variables

### Backend (`transcribe-server/.env`)

```
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here

#### Endpoints

POST /transcribe (multipart form field file)

POST /ingest { text, meta }

GET /search?q=...&k=5

GET /answer?q=...&k=5

GET /library

#### Quick test

bash
Copy
Edit
curl -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{"text":"We decided the budget is 10k and launch is October 12. Ana writes copy, Marco builds landing page.","meta":{"source":"test","title":"Kickoff call"}}'


```

### Frontend (`expo-voice-demo/.env`)

```
API_URL=http://<your-local-ip>:3000

How to find YOUR_LAN_IP:

macOS: System Settings → Network (or ifconfig and take the inet under Wi-Fi, usually 192.168.x.x)

Windows: ipconfig → IPv4 Address

Linux: ip a or hostname -I
```


---

## 🛠 Tech Stack

* **Frontend:** React Native, Expo
* **Backend:** Node.js, Express
* **Speech-to-Text:** AI model (e.g., Whisper API, Google Speech API, etc.)
* **Storage:** Local file storage for uploads

---

## ✨ Features

* 🎙 Record voice directly from your mobile device
* 🔄 Upload audio to backend server
* 📝 AI-based speech-to-text transcription
* 🌍 Designed to work in low-resource environments

---


## 📌 Next Steps

* Integrate real-time transcription
* Add multi-language support
* Deploy backend to cloud

```


