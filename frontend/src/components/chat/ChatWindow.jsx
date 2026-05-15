import { useEffect, useRef, useState } from "react";
import { chatApi } from "../../api/endpoints";
import Button from "../common/Button";

const CHAT_POLL_MS = 3000;

const ChatWindow = ({ rentalId, onClose, placement = "drawer" }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const loadMessages = async () => {
    if (!rentalId) return;
    try {
      const res = await chatApi.listMessages(rentalId);
      setMessages(res.data.data.messages);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load chat.");
    }
  };

  useEffect(() => {
    loadMessages();
    const intervalId = window.setInterval(loadMessages, CHAT_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [rentalId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      setError("");
      await chatApi.send({ rentalId, content: text.trim() });
      setText("");
      await loadMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message.");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (!rentalId) return null;

  const shellClass =
    placement === "inline"
      ? "animate-fade-up flex h-[640px] min-h-[640px] flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-md"
      : placement === "overlay"
        ? "animate-fade-up absolute right-4 top-4 z-30 flex h-[min(70vh,640px)] w-[min(420px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md"
      : "animate-fade-up fixed bottom-4 left-4 right-4 z-50 flex h-[68vh] max-h-[720px] flex-col overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-md sm:left-auto sm:w-[min(420px,calc(100vw-2rem))] lg:bottom-6 lg:right-6 lg:h-[640px] lg:w-[420px]";

  return (
    <section className={shellClass}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="font-display text-base font-bold">In-app chat</h3>
          <p className="text-xs text-zinc-400">Updates automatically every few seconds.</p>
        </div>
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900/80 p-2">
          {messages.map((msg) => (
            <div key={msg._id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs">
              <p className="font-semibold">{msg.senderId?.name}</p>
              <p className="text-zinc-300">{msg.content}</p>
            </div>
          ))}
          {!messages.length ? <p className="text-xs text-zinc-500">No messages yet.</p> : null}
          <div ref={messagesEndRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    </section>
  );
};

export default ChatWindow;
