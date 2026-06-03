import { useState, useEffect } from 'react';
import { Play, ExternalLink, Clock, Video, Search, Loader2 } from 'lucide-react';
import { getTopicVideos } from '../../lib/tauri/commands';
import type { Video as VideoType } from '../../lib/tauri/commands';

interface VideosTabProps {
  subject: string;
  topic: string;
  classLevel: string;
}

// Curated educational YouTube videos for Nigerian curriculum topics
const curatedVideos: Record<string, { title: string; youtubeId: string; duration: string }[]> = {
  'Whole Numbers': [
    { title: 'Understanding Place Value - Primary Maths', youtubeId: 'rpelS9Lxeas', duration: '8:30' },
    { title: 'Ordering and Comparing Numbers', youtubeId: 'YNc1uUMWP-Y', duration: '6:15' },
  ],
  'Addition and Subtraction': [
    { title: 'Addition and Subtraction of Large Numbers', youtubeId: 'Fe8u2I_eksQ', duration: '10:00' },
  ],
  'Multiplication and Division': [
    { title: 'Long Multiplication Made Easy', youtubeId: 'mv6mUyYBmgY', duration: '9:45' },
    { title: 'Division of Whole Numbers', youtubeId: 'W4QBCdMhP38', duration: '7:20' },
  ],
  Fractions: [
    { title: 'Introduction to Fractions', youtubeId: 'kZy0Hgp2Z4Y', duration: '12:00' },
    { title: 'Adding and Subtracting Fractions', youtubeId: 'bX7ilcdsOhQ', duration: '10:30' },
  ],
  'Linear Equations': [
    { title: 'Solving Linear Equations Step by Step', youtubeId: 'GmMX3-nTWbE', duration: '14:20' },
    { title: 'Linear Equations Word Problems', youtubeId: '9IUEk9fn2Vs', duration: '11:00' },
  ],
  'Algebraic Expressions': [
    { title: 'Introduction to Algebra for Beginners', youtubeId: 'NybHckSEQBI', duration: '15:00' },
    { title: 'Simplifying Algebraic Expressions', youtubeId: '3nQejB-XPoY', duration: '8:45' },
  ],
  'Parts of Speech': [
    { title: 'The 8 Parts of Speech Explained', youtubeId: 'prMBa0gAP0c', duration: '12:00' },
    { title: 'Nouns, Verbs, Adjectives & Adverbs', youtubeId: '3TAiMkl8HPo', duration: '9:30' },
  ],
  'Sentence Structure': [
    { title: 'Understanding Sentence Structure', youtubeId: 'TP-PCWeCuYE', duration: '10:15' },
  ],
  Photosynthesis: [
    { title: 'Photosynthesis - How Plants Make Food', youtubeId: 'UPBMG5EYydo', duration: '8:00' },
    { title: 'The Process of Photosynthesis Explained', youtubeId: 'sQK3Yr4Sc_k', duration: '6:30' },
  ],
  'Number Bases': [
    { title: 'Number Base Conversion Made Easy', youtubeId: 'T3pOqJEysjg', duration: '13:00' },
  ],
  'The Solar System': [
    { title: 'The Solar System - Planets and Space', youtubeId: 'libKVRa01L8', duration: '10:00' },
  ],
  Energy: [
    { title: 'Forms of Energy and Energy Transformation', youtubeId: 'CW0_S5YpYVo', duration: '9:00' },
  ],
};

export default function VideosTab({ subject, topic, classLevel }: VideosTabProps) {
  const [dbVideos, setDbVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const vids = await getTopicVideos(subject, topic);
        setDbVideos(vids);
      } catch (err) {
        console.error('Failed to load videos:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subject, topic]);

  // Combine DB videos with curated ones
  const curated = curatedVideos[topic] || [];
  const allVideos = [
    ...dbVideos.map((v) => ({
      id: v.id,
      title: v.title,
      youtubeId: v.youtube_id || '',
      duration: v.duration_seconds ? `${Math.floor(v.duration_seconds / 60)}:${(v.duration_seconds % 60).toString().padStart(2, '0')}` : '',
      description: v.description || '',
      source: 'saved' as const,
    })),
    ...curated.map((v, i) => ({
      id: `curated-${i}`,
      title: v.title,
      youtubeId: v.youtubeId,
      duration: v.duration,
      description: '',
      source: 'curated' as const,
    })),
  ];

  const filtered = searchQuery
    ? allVideos.filter((v) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : allVideos;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-text-secondary">Loading videos...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Active video player */}
      {activeVideo && (
        <div className="mb-6">
          <div className="relative w-full aspect-video rounded-[16px] overflow-hidden bg-black shadow-lg">
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&rel=0`}
              title="Video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
          <button
            onClick={() => setActiveVideo(null)}
            className="mt-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Close player
          </button>
        </div>
      )}

      {/* Search */}
      {allVideos.length > 3 && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search videos..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {/* Video grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Video size={48} className="mx-auto text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Videos Available</h3>
          <p className="text-text-secondary max-w-md mx-auto">
            There are no videos for <strong>{topic}</strong> yet. Your teacher can add videos, or check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((video) => (
            <div
              key={video.id}
              className="bg-white rounded-[16px] shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setActiveVideo(video.youtubeId)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={24} className="text-primary ml-1" />
                  </div>
                </div>
                {video.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock size={10} />
                    {video.duration}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h4 className="text-sm font-semibold text-text-primary line-clamp-2">{video.title}</h4>
                {video.description && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-1">{video.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search YouTube link */}
      <div className="mt-6 text-center">
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} ${subject} ${classLevel} Nigeria`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink size={14} />
          Search YouTube for more videos
        </a>
      </div>
    </div>
  );
}
