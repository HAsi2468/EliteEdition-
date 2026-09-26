import React, { useState, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Upload, 
  Download, 
  Tag, 
  Maximize2, 
  X, 
  Eye, 
  Heart,
  Share2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

const INITIAL_GALLERY_ITEMS = [
  {
    id: 'gal-1',
    title: 'Floral Silk Digital Print 2026',
    code: 'DES-8092-A',
    category: 'Digital Prints',
    fabric: 'Pure Silk Crepe 60g',
    tags: ['Floral', 'Silk', 'Spring-Summer', 'Multicolor'],
    client: 'Shreeji Silk Mills',
    date: '2026-09-20',
    dimensions: '3000 x 4200 px',
    size: '14.2 MB',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    likes: 42
  },
  {
    id: 'gal-2',
    title: 'Geometric Chevron Jacquard Texture',
    code: 'DES-7741-B',
    category: 'Textures & Fusing',
    fabric: 'Poly-Cotton Blend',
    tags: ['Chevron', 'Geometric', 'Jacquard', 'Navy'],
    client: 'Apex Garments',
    date: '2026-09-18',
    dimensions: '2800 x 3800 px',
    size: '9.8 MB',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
    likes: 29
  },
  {
    id: 'gal-3',
    title: 'Kashmiri Ari Zari Embroidery Proof',
    code: 'EMB-4091-Z',
    category: 'Embroidery',
    fabric: 'Chanderi Chiffon',
    tags: ['Ari Work', 'Zari Gold', 'Bridal', 'Kurti'],
    client: 'Radhika Fashion Hub',
    date: '2026-09-15',
    dimensions: '3400 x 4800 px',
    size: '18.4 MB',
    url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80',
    likes: 67
  },
  {
    id: 'gal-4',
    title: 'Ethnic Mughal Booti Block Motif',
    code: 'DES-6620-M',
    category: 'Digital Prints',
    fabric: 'Modal Satin 80g',
    tags: ['Mughal', 'Booti', 'Gold Foil', 'Traditional'],
    client: 'Royal Jaipur Fabrics',
    date: '2026-09-14',
    dimensions: '2500 x 3500 px',
    size: '8.4 MB',
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop&q=80',
    likes: 35
  },
  {
    id: 'gal-5',
    title: 'Anarkali 3-Piece Stitching Mockup',
    code: 'ST-9912-MC',
    category: 'Garment Mockups',
    fabric: 'Georgette + Santoon Inner',
    tags: ['Anarkali', 'Ready-to-wear', 'Sample', 'Pastel Pink'],
    client: 'Westside Vendor #12',
    date: '2026-09-12',
    dimensions: '4000 x 4000 px',
    size: '22.1 MB',
    url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
    likes: 54
  },
  {
    id: 'gal-6',
    title: 'Abstract Watercolour Ombre Wash',
    code: 'DES-9014-W',
    category: 'Digital Prints',
    fabric: 'Organza Viscose',
    tags: ['Ombre', 'Watercolor', 'Modern', 'Dupatta'],
    client: 'Arvind Mills Direct',
    date: '2026-09-10',
    dimensions: '3200 x 4500 px',
    size: '16.7 MB',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    likes: 48
  },
  {
    id: 'gal-7',
    title: 'Denim Laser Wash & Distressing Proof',
    code: 'DNM-3011-L',
    category: 'Textures & Fusing',
    fabric: 'Indigo Slub Denim 12oz',
    tags: ['Denim', 'Laser Finish', 'Casual', 'Indigo'],
    client: 'Zara India Hub',
    date: '2026-09-08',
    dimensions: '2600 x 3600 px',
    size: '11.3 MB',
    url: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80',
    likes: 31
  },
  {
    id: 'gal-8',
    title: 'Heavy Resham Mirror Work Border',
    code: 'EMB-8820-R',
    category: 'Embroidery',
    fabric: 'Velvet 9000 Micro',
    tags: ['Mirror Work', 'Resham', 'Lehenga', 'Emerald'],
    client: 'Bollywood Prints',
    date: '2026-09-05',
    dimensions: '3600 x 5000 px',
    size: '24.6 MB',
    url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&auto=format&fit=crop&q=80',
    likes: 82
  }
];

const CATEGORIES = ['All', 'Digital Prints', 'Embroidery', 'Textures & Fusing', 'Garment Mockups'];

export default function Gallery() {
  const [items, setItems] = useState(INITIAL_GALLERY_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [activeItem, setActiveItem] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // New item upload form
  const [newDesign, setNewDesign] = useState({
    title: '',
    code: '',
    category: 'Digital Prints',
    fabric: '',
    tags: '',
    client: '',
    url: ''
  });

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchesCat = selectedCategory === 'All' || it.category === selectedCategory;
      const matchesQuery = 
        it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesQuery;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleLike = (id, e) => {
    e.stopPropagation();
    setItems(prev => prev.map(item => item.id === id ? { ...item, likes: item.likes + 1 } : item));
    if (activeItem?.id === id) {
      setActiveItem(prev => ({ ...prev, likes: prev.likes + 1 }));
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!newDesign.title || !newDesign.url) return;

    const created = {
      id: `gal-${Date.now()}`,
      title: newDesign.title,
      code: newDesign.code || `DES-${Math.floor(1000 + Math.random() * 9000)}`,
      category: newDesign.category,
      fabric: newDesign.fabric || 'Cotton Blend',
      tags: newDesign.tags.split(',').map(s => s.trim()).filter(Boolean),
      client: newDesign.client || 'Internal Collection',
      date: new Date().toISOString().split('T')[0],
      dimensions: '3000 x 4000 px',
      size: '12.5 MB',
      url: newDesign.url,
      likes: 0
    };

    setItems([created, ...items]);
    setShowUploadModal(false);
    setNewDesign({
      title: '',
      code: '',
      category: 'Digital Prints',
      fabric: '',
      tags: '',
      client: '',
      url: ''
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(236,72,153,0.3)'
          }}>
            <ImageIcon size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Design & Media Gallery</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              High-resolution digital print patterns, embroidery proofs, and fabric archives
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search design code, tag, client..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem 0.45rem 2rem',
                fontSize: '0.82rem',
                borderRadius: 8,
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                width: 220
              }}
            />
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-light)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                border: 'none',
                background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none'
              }}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                border: 'none',
                background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            <Upload size={14} />
            <span>Upload Proof</span>
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div style={{
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: 700,
              border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-light)',
              background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-input)',
              color: selectedCategory === cat ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {cat} {cat === 'All' ? `(${items.length})` : `(${items.filter(i => i.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Main Gallery Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem'
          }}>
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 12,
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Image Preview Container */}
                <div style={{ position: 'relative', width: '100%', height: 210, background: '#000', overflow: 'hidden' }}>
                  <img
                    src={item.url}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                    loading="lazy"
                  />
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {item.code}
                  </div>
                  <button
                    onClick={(e) => handleLike(item.id, e)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Heart size={14} fill={item.likes > 0 ? '#ef4444' : 'none'} color={item.likes > 0 ? '#ef4444' : '#fff'} />
                  </button>
                </div>

                {/* Card Content */}
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Client: <strong style={{ color: 'var(--text-primary)' }}>{item.client}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Fabric: {item.fabric}
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    {item.tags.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--bg-input)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Preview</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Design Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Client</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fabric Spec</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveItem(item)}
                    style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--nav-active-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <img src={item.url} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover' }} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{item.code}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{item.title}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(56,189,248,0.12)', color: '#0284c7' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.client}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.fabric}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.date}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveItem(item); }}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: 'var(--bg-input)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox / Detail Modal */}
      {activeItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            position: 'relative',
            width: 900,
            maxWidth: '96vw',
            maxHeight: '92vh',
            background: 'var(--bg-modal)',
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            border: '1px solid var(--border-light)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            {/* Close button */}
            <button
              onClick={() => setActiveItem(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={18} />
            </button>

            {/* Left Image View */}
            <div style={{ flex: 1.3, background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', minHeight: 400 }}>
              <img
                src={activeItem.url}
                alt={activeItem.title}
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}
              />
            </div>

            {/* Right Info Column */}
            <div style={{ width: 340, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  {activeItem.category}
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {activeItem.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Code: {activeItem.code}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Client Account</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{activeItem.client}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Resolution</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{activeItem.dimensions}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Fabric Specification</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{activeItem.fabric}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>File Size</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{activeItem.size}</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 4 }}>
                  {activeItem.tags.map((t, idx) => (
                    <span key={idx} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                <a
                  href={activeItem.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 8,
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <form
            onSubmit={handleUploadSubmit}
            style={{
              width: 440,
              maxWidth: '96vw',
              background: 'var(--bg-modal)',
              borderRadius: 12,
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Upload Design Proof</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Design Title</label>
              <input
                type="text"
                required
                value={newDesign.title}
                onChange={e => setNewDesign({ ...newDesign, title: e.target.value })}
                placeholder="e.g. Royal Mughal Floral Pattern"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Category</label>
                <select
                  value={newDesign.category}
                  onChange={e => setNewDesign({ ...newDesign, category: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4 }}
                >
                  <option value="Digital Prints">Digital Prints</option>
                  <option value="Embroidery">Embroidery</option>
                  <option value="Textures & Fusing">Textures & Fusing</option>
                  <option value="Garment Mockups">Garment Mockups</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Client Name</label>
                <input
                  type="text"
                  value={newDesign.client}
                  onChange={e => setNewDesign({ ...newDesign, client: e.target.value })}
                  placeholder="e.g. Radhika Silk Mills"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Image URL / Proof Link</label>
              <input
                type="url"
                required
                value={newDesign.url}
                onChange={e => setNewDesign({ ...newDesign, url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Tags (comma-separated)</label>
              <input
                type="text"
                value={newDesign.tags}
                onChange={e => setNewDesign({ ...newDesign, tags: e.target.value })}
                placeholder="Silk, Floral, Pink, Summer"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', marginTop: 4, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Proof
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
