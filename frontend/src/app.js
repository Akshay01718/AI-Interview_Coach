import React, { useState, useRef } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [numQuestions, setNumQuestions] = useState(5);
  const [loadingNextQuestion, setLoadingNextQuestion] = useState(false);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  const startSession = async () => {
    if (numQuestions < 5 || numQuestions > 20) return alert("Please choose between 5 and 20 questions.");
    try {
      const res = await axios.post("https://interview-backend-vel8.onrender.com/start_session", { num_questions: numQuestions });
      setSessionId(res.data.session_id);
      setCurrentQuestion(res.data.question);
      setAnswer("");
      setScore(null);
      setFeedback(null);
      setFinished(false);
      setResults([]);
      setQuestionsCount(1);
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Could not start session. Make sure backend is running.");
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) return alert("Please type or speak your answer.");

    setLoadingNextQuestion(true);

    try {
      const res = await axios.post("https://interview-backend-vel8.onrender.com/submit_answer", {
        session_id: sessionId,
        answer: answer,
      });

      setScore(res.data.score);
      setFeedback(res.data.feedback);

      const newResults = [
        ...results,
        { question: currentQuestion, answer, score: res.data.score, feedback: res.data.feedback },
      ];
      setResults(newResults);

      if (res.data.next_question) {
        // small delay for fun effect
        setTimeout(() => {
          setCurrentQuestion(res.data.next_question);
          setAnswer("");
          setQuestionsCount((prev) => prev + 1);
          setLoadingNextQuestion(false);
        }, 500);
      } else {
        setCurrentQuestion(null);
        setFinished(true);
        setLoadingNextQuestion(false);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      alert("Could not reach backend. Make sure it is running.");
      setLoadingNextQuestion(false);
    }
  };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) return alert("Speech recognition not supported.");
    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event) => {
      setAnswer(event.results[0][0].transcript);
      setListening(false);
    };
    recognitionRef.current.onend = () => setListening(false);
    recognitionRef.current.start();
    setListening(true);
  };

  const getScoreColor = (score) => (score >= 80 ? "#4caf50" : score >= 50 ? "#ff9800" : "#f44336");
  const progress = finished ? 100 : questionsCount > 0 ? Math.min((questionsCount / numQuestions) * 100, 100) : 0;

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", maxWidth: "850px", margin: "auto", padding: "20px" }}>
      <h1 style={{ textAlign: "center", color: "#333", marginBottom: "40px" }}>AI Interview Coach 🎤</h1>

      {!sessionId && (
        <div style={{ textAlign: "center" }}>
          <label style={{ fontSize: "16px" }}>
            Number of Questions (5-20):{" "}
            <input
              type="number"
              value={numQuestions}
              min={5}
              max={20}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              style={{ width: "60px", padding: "5px", marginRight: "10px", fontSize: "16px" }}
            />
          </label>
          <button
            onClick={startSession}
            style={{
              padding: "10px 25px",
              fontSize: "16px",
              marginLeft: "10px",
              background: "linear-gradient(90deg, #4caf50, #81c784)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
            }}
          >
            Start Interview
          </button>
        </div>
      )}

      {sessionId && !finished && currentQuestion && (
        <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              fontWeight: "bold",
              fontSize: "18px",
              color: "#333",
            }}
          >
            Question {questionsCount}: {currentQuestion}
          </div>

          <textarea
            rows="5"
            placeholder="Type your answer here..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            style={{
              padding: "15px",
              fontSize: "15px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #ccc",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
              transition: "all 0.3s",
            }}
          />

          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            <button
              onClick={startListening}
              disabled={listening}
              style={{
                padding: "12px 22px",
                fontSize: "14px",
                background: "#2196f3",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: listening ? "not-allowed" : "pointer",
                boxShadow: "0 3px 6px rgba(0,0,0,0.15)",
                transition: "all 0.2s",
              }}
            >
              {listening ? "Listening..." : "🎤 Speak Answer"}
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: "12px 22px",
                fontSize: "14px",
                background: "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 3px 6px rgba(0,0,0,0.15)",
                transition: "all 0.2s",
              }}
            >
              Submit Answer
            </button>
          </div>

          {/* Fun Loading Indicator */}
          {loadingNextQuestion && (
            <div style={{ marginTop: "15px", fontSize: "16px", fontWeight: "bold", color: "#4caf50", display: "flex", justifyContent: "center", gap: "5px" }}>
              <span>🤖 Thinking</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </div>
          )}

          <div style={{ background: "#eee", borderRadius: "15px", height: "16px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #4caf50, #81c784)",
                transition: "width 0.5s",
              }}
            ></div>
          </div>
        </div>
      )}

      {score !== null && feedback && (
        <div
          style={{
            marginTop: "20px",
            padding: "18px",
            borderRadius: "12px",
            background: "#fafafa",
            boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
            borderLeft: `5px solid ${getScoreColor(score)}`,
          }}
        >
          <h3 style={{ marginBottom: "10px", color: "#333" }}>Feedback</h3>
          <p>
            <strong>Score:</strong>{" "}
            <span style={{ color: getScoreColor(score), fontWeight: "bold" }}>{score.toFixed(1)}</span>
          </p>
          <p>
            <strong>AI Suggestions:</strong>
          </p>
          <p style={{ whiteSpace: "pre-wrap", color: "#555" }}>{feedback}</p>
        </div>
      )}

      {finished && (
        <div style={{ marginTop: "30px" }}>
          <h2 style={{ textAlign: "center", color: "#333" }}>Interview Finished ✅</h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={results} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="question" hide={true} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
            {results.map((item, index) => (
              <div
                key={index}
                style={{
                  background: "#f0f0f0",
                  padding: "15px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.3s",
                }}
              >
                <p>
                  <strong>Question:</strong> {item.question}
                </p>
                <p>
                  <strong>Answer:</strong> {item.answer}
                </p>
                <p>
                  <strong>Score:</strong>{" "}
                  <span style={{ color: getScoreColor(item.score), fontWeight: "bold" }}>{item.score.toFixed(1)}</span>
                </p>
                <p>
                  <strong>AI Feedback:</strong>
                </p>
                <p style={{ whiteSpace: "pre-wrap", color: "#555" }}>{item.feedback}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 25px",
                fontSize: "16px",
                background: "linear-gradient(90deg, #2196f3, #64b5f6)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 3px 6px rgba(0,0,0,0.15)",
              }}
            >
              Start New Interview
            </button>
          </div>
        </div>
      )}

      {/* Add simple dot animation */}
      <style>
        {`
          @keyframes blink {
            0%, 20%, 50%, 80%, 100% { opacity: 1; }
            10%, 30%, 60%, 90% { opacity: 0; }
          }
          .dot { animation: blink 1.4s infinite; }
          .dot:nth-child(2) { animation-delay: 0.2s; }
          .dot:nth-child(3) { animation-delay: 0.4s; }
          .dot:nth-child(4) { animation-delay: 0.6s; }
        `}
      </style>
    </div>
  );
}

export default App;
