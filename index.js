// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if the Speech Recognition API is available
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    console.error('Speech Recognition API not supported in this browser');
    document.getElementById("Spoken").textContent = "Speech Recognition not supported in this browser";
    return;
  }

  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US'; // Default language
  let currentTranscript = '';
  let silenceTimer = null;
  let spoke = undefined;
  let lastSpoke = spoke;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        currentTranscript += result[0].transcript + ' ';
      }
    }

    if (silenceTimer) clearTimeout(silenceTimer);
    console.log("arae")
    silenceTimer = setTimeout(() => {
      console.log('Final sentence:', currentTranscript.trim());
      spoke = currentTranscript.trim();
      console.log(spoke)
      // Handle commands
      if (spoke.toLowerCase() === "open chrome") {
        console.log("Command detected: Opening Chrome");
        fetch('https://localhost:3000/open?app=chrome');
        console.log("fetched")
      }
      if (spoke.toLowerCase() === "open arknights") {
        console.log("Command detected: Opening best game");
        fetch('https://localhost:3000/open?app=arknights');
        console.log("fetched")
      }

      // Add more commands here
      // else if (spoke.toLowerCase() === "open notepad") {
      //   fetch('http://localhost:3000/open?app=notepad');
      // }

      currentTranscript = '';
    }, 1000); // 1 second after speaking ends
  };

  recognition.onend = () => {
    recognition.start(); // Keep listening forever
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  // Start recognition
  try {
    recognition.start();
    console.log("listening")
  } catch (e) {
    console.error('Failed to start speech recognition:', e);
  }

  // Function to change language
  function changeLanguage(langCode) {
    recognition.stop();
    recognition.lang = langCode;
    recognition.start();
  }

  // Set up language selector
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }

  // Display last spoken words
  setInterval(() => {
    if (spoke !== lastSpoke) {
      document.getElementById("Spoken").textContent = spoke;
      lastSpoke = spoke;
    }
  }, 10);
});
