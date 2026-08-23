import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons.jsx';

// Fixed bottom-left corner button. Click reveals a small popover with three
// contact links; click the button again, click outside, or Escape closes it.
// Neutral surface/border/ink tokens only - no accent color, per instruction.
export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="contact-widget" ref={rootRef}>
      {open && (
        <div className="contact-pop" role="menu">
          <a className="contact-pop-link" href="mailto:abdullahmahfouz@trentu.ca" role="menuitem">
            <span className="contact-pop-icon"><Icons.Envelope/></span>
            abdullahmahfouz@trentu.ca
          </a>
          <a className="contact-pop-link" href="https://github.com/abdullahmahfouz" target="_blank" rel="noopener noreferrer" role="menuitem">
            <span className="contact-pop-icon"><Icons.Github/></span>
            github.com/abdullahmahfouz
          </a>
          {/* TODO: no LinkedIn URL was given - swap in the real profile link. */}
          <a className="contact-pop-link" href="#" role="menuitem">
            <span className="contact-pop-icon"><Icons.Linkedin/></span>
            Connect on LinkedIn
          </a>
          <a className="contact-pop-link contact-pop-more" href="/contact" role="menuitem">
            Full contact page
          </a>
        </div>
      )}
      <button
        type="button"
        className="contact-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close contact links' : 'Contact'}
        title="Contact"
      >
        {open ? <Icons.X/> : <Icons.Envelope/>}
      </button>
    </div>
  );
}
