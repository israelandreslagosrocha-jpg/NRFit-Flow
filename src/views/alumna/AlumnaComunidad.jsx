import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Heart, Send, Gift, Copy, Check, Users } from 'lucide-react';
import './AlumnaComunidad.css';

export default function AlumnaComunidad() {
  const { user } = useAuth();

  const [posts, setPosts] = useState([
    {
      id: 'p1',
      author: 'Valentina Silva',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
      time: 'Hace 2 horas',
      text: '¡Terminada la clase GAP de hoy! Los puentes de glúteo de Naty me dejaron temblando pero feliz 💪🔥',
      likes: 12,
      isLiked: false,
      system: 'GAP en Casa Mujeres'
    },
    {
      id: 'p2',
      author: 'Camila Rojas',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      time: 'Hace 5 horas',
      text: '¿Alguna recomendación para las agujetas en cuadriceps? El Tip del Día de ayer me ayudó mucho.',
      likes: 8,
      isLiked: true,
      system: 'Team Naty Online'
    }
  ]);

  const [newPostText, setNewPostText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const handlePostSubmit = (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    setPosts([
      {
        id: Date.now().toString(),
        author: user.name,
        avatar: user.avatar,
        time: 'Justo ahora',
        text: newPostText,
        likes: 0,
        isLiked: false,
        system: user.systemName
      },
      ...posts
    ]);
    setNewPostText('');
  };

  const toggleLike = (postId) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: p.isLiked ? p.likes - 1 : p.likes + 1,
          isLiked: !p.isLiked
        };
      }
      return p;
    }));
  };

  const copyReferral = () => {
    navigator.clipboard.writeText('NATY-CAROLINA-2026');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="alumna-comunidad-page animate-fade-in">
      <div className="comunidad-header">
        <h1 className="comunidad-title">Comunidad & Conexión con Naty</h1>
        <p className="comunidad-subtitle">Comparte tus logros, inspírate con otras alumnas y mantén el contacto directo.</p>
      </div>

      {/* Invita y Gana Banner */}
      <div className="invite-banner glass-card">
        <div className="invite-left">
          <div className="gift-badge">
            <Gift size={18} />
            <span>INVITA Y GANA</span>
          </div>
          <h3>Comparte la experiencia con una amiga</h3>
          <p>Regala 7 días gratis. Por cada amiga que se suscriba al precio fundador ($25.000 CLP), recibes $10.000 CLP de descuento en tu siguiente renovación.</p>
        </div>

        <div className="invite-code-box">
          <span className="code-lbl">Tu código personal:</span>
          <div className="code-input-row">
            <span className="code-val">NATY-CAROLINA-2026</span>
            <button onClick={copyReferral} className="copy-btn">
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="comunidad-layout-grid">
        {/* Main Feed */}
        <div className="community-feed">
          {/* Create Post Card */}
          <form onSubmit={handlePostSubmit} className="create-post-card glass-card">
            <div className="create-post-input-row">
              <img src={user.avatar} alt={user.name} className="post-author-avatar" />
              <textarea
                placeholder={`¿Cómo te fue en tu entrenamiento hoy, ${user.name.split(' ')[0]}?`}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                className="post-textarea"
                rows={3}
              />
            </div>
            <div className="create-post-footer">
              <span className="post-system-tag">Publicando como: {user.systemName}</span>
              <button type="submit" className="btn btn-primary btn-sm">
                <Send size={14} />
                <span>Publicar</span>
              </button>
            </div>
          </form>

          {/* Posts List */}
          <div className="posts-list">
            {posts.map(post => (
              <div key={post.id} className="post-card glass-card">
                <div className="post-card-header">
                  <img src={post.avatar} alt={post.author} className="post-author-avatar" />
                  <div className="post-author-info">
                    <span className="author-name">{post.author}</span>
                    <span className="post-meta">{post.time} • {post.system}</span>
                  </div>
                </div>

                <p className="post-text">{post.text}</p>

                <div className="post-actions">
                  <button 
                    onClick={() => toggleLike(post.id)}
                    className={`like-btn ${post.isLiked ? 'liked' : ''}`}
                  >
                    <Heart size={16} fill={post.isLiked ? '#E91E63' : 'none'} />
                    <span>{post.likes} Me gusta</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Direct Contact with Naty */}
        <div className="community-sidebar">
          <div className="naty-direct-card glass-card">
            <div className="naty-card-header">
              <img 
                src="https://images.unsplash.com/photo-1594381898411-846e7d193883?w=150&auto=format&fit=crop&q=80" 
                alt="Naty Entrenadora" 
                className="naty-profile-img"
              />
              <div>
                <h4 className="naty-card-name">Naty Entrenadora</h4>
                <span className="naty-online-tag">🟢 En línea para responderte</span>
              </div>
            </div>

            <p className="naty-card-desc">
              ¿Tienes alguna duda sobre tu postura, dolor muscular o sobre tu plan? Escríbeme directamente.
            </p>

            <button className="btn btn-primary btn-sm btn-full">
              <MessageSquare size={16} />
              <span>Enviar Mensaje Directo a Naty</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
