import { Icons } from './Icons.jsx';
import { relativeTime } from '../lib/storage.js';

export function ChatHistory({ sessions, currentId, onSelect, onNew, onDelete }) {
  return (
    <aside className="history-rail">
      <div className="history-head">
        <span className="history-label">Chats</span>
        <button className="history-new" onClick={onNew} title="New chat">
          <Icons.Plus/>
        </button>
      </div>

      <div className="history-list">
        {sessions.length === 0 ? (
          <div className="history-empty">
            No chats yet. Click + to start.
          </div>
        ) : (
          sessions.map(s => (
            <button
              key={s.id}
              className={`history-item ${s.id === currentId ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="history-chat-icon"><Icons.Chat/></span>
              <span className="history-title">{s.title || 'New chat'}</span>
              <span className="history-time">{relativeTime(s.updatedAt)}</span>
              <span
                className="history-delete"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                title="Delete chat"
              >
                <Icons.X/>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
