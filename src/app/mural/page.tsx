'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const IMGUR_CLIENT_ID = '546c25a59c58ad7';

interface Post {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_role: string;
  texto: string | null;
  imagem_url: string | null;
  created_at: string;
}

export default function MuralPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [academiaId, setAcademiaId] = useState('');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState('');
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/'; return; }
    setUser(user);

    const { data: prof } = await supabase.from('profiles').select('nome, role, academia_id').eq('id', user.id).single();
    if (!prof) { window.location.href = '/'; return; }
    
    setProfile(prof);
    
    // Pegar academia_id do profile ou do localStorage
    const acadId = prof.academia_id || localStorage.getItem('academia_id');
    if (!acadId) { window.location.href = '/'; return; }
    
    setAcademiaId(acadId);
    loadPosts(acadId);
  };

  const loadPosts = async (acadId: string) => {
    const { data } = await supabase
      .from('mural_posts')
      .select('*')
      .eq('academia_id', acadId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPosts(data);
    setLoading(false);
  };

  const uploadToImgur = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) return data.data.link;
      return null;
    } catch {
      return null;
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Imagem deve ter no máximo 10MB'); return; }
    setImagem(file);
    setImagemPreview(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!texto.trim() && !imagem) return;
    setPosting(true);

    let imgUrl: string | null = null;
    if (imagem) {
      imgUrl = await uploadToImgur(imagem);
      if (!imgUrl) { alert('Erro ao enviar imagem. Tente novamente.'); setPosting(false); return; }
    }

    await supabase.from('mural_posts').insert({
      academia_id: academiaId,
      autor_id: user.id,
      autor_nome: profile.nome,
      autor_role: profile.role,
      texto: texto.trim() || null,
      imagem_url: imgUrl,
    });

    setTexto('');
    setImagem(null);
    setImagemPreview('');
    setPosting(false);
    loadPosts(academiaId);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Excluir este post?')) return;
    await supabase.from('mural_posts').delete().eq('id', postId);
    loadPosts(academiaId);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  const handleVoltar = () => {
    if (profile?.role === 'admin') window.location.href = '/dashboard/';
    else if (profile?.role === 'professor') window.location.href = '/professor/';
    else window.location.href = '/aluno/';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString('pt-BR');
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return { label: 'Professor', color: 'bg-primary-900/30 text-primary-400' };
    if (role === 'professor') return { label: 'Professor', color: 'bg-blue-900/30 text-blue-400' };
    return { label: 'Aluno', color: 'bg-dark-700 text-dark-300' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-dark-800 border-b border-dark-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleVoltar} className="text-dark-400 hover:text-dark-200">←</button>
            <h1 className="font-bold text-dark-100">📢 Mural</h1>
          </div>
          <button onClick={handleLogout} className="text-sm text-dark-400 hover:text-red-400">Sair</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Criar post */}
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary-400">{profile?.nome?.charAt(0)}</span>
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Compartilhe algo com a turma..."
                className="input-field resize-none"
                rows={2}
              />
              {imagemPreview && (
                <div className="relative">
                  <img src={imagemPreview} alt="Preview" className="rounded-xl max-h-48 object-cover" />
                  <button onClick={() => { setImagem(null); setImagemPreview(''); }} className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <button onClick={() => fileRef.current?.click()} className="text-sm text-dark-400 hover:text-primary-400 flex items-center gap-1">
                  📷 Foto
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                <button
                  onClick={handlePost}
                  disabled={posting || (!texto.trim() && !imagem)}
                  className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
                >
                  {posting ? 'Enviando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="card text-center py-12">
            <span className="text-4xl block mb-2">📢</span>
            <p className="text-dark-400">Nenhuma publicação ainda. Seja o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const badge = getRoleBadge(post.autor_role);
              const isOwner = post.autor_id === user?.id || profile?.role === 'admin';
              return (
                <div key={post.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-dark-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-dark-200">{post.autor_nome?.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-dark-100 text-sm">{post.autor_nome}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${badge.color}`}>{badge.label}</span>
                        <span className="text-xs text-dark-500">{formatDate(post.created_at)}</span>
                        {isOwner && (
                          <button onClick={() => handleDelete(post.id)} className="ml-auto text-xs text-dark-500 hover:text-red-400">🗑</button>
                        )}
                      </div>
                      {post.texto && <p className="text-dark-200 text-sm whitespace-pre-line">{post.texto}</p>}
                      {post.imagem_url && (
                        <img src={post.imagem_url} alt="" className="mt-3 rounded-xl max-h-80 w-full object-cover" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
