import { useEffect, useState } from "react";
import { chatApi } from "../../api/endpoints";
import Button from "../common/Button";

const ChatWindow = ({ rentalId }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const loadMessages = async () => {
    if (!rentalId) return;
    try {
      const res = await chatApi.listMessages(rentalId);
      setMessages(res.data.data.messages);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load chat.");
    }
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      await chatApi.send({ rentalId, content: text.trim() });
      setText("");
      loadMessages();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message.");
    }
  };

  if (!rentalId) return null;

  return (
    <section className="animate-fade-up rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 backdrop-blur-sm">
      <h3 className="font-display text-base font-bold">In-app chat</h3>
      <div className="mt-3 h-56 space-y-2 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/80 p-2">
        {messages.map((msg) => (
          <div key={msg._id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs">
            <p className="font-semibold">{msg.senderId?.name}</p>
            <p className="text-zinc-300">{msg.content}</p>
          </div>
        ))}
        {!messages.length ? <p className="text-xs text-zinc-500">No messages yet.</p> : null}
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
    </section>
  );
};

export default ChatWindow;
