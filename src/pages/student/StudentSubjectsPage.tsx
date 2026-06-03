import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calculator, FlaskConical, Globe, Wrench, Lock, Clock,
  ChevronRight, Layers, CheckCircle, Play, ArrowRight, Sparkles,
  Monitor, Landmark, Leaf, ShoppingCart, Palette, MusicIcon, Dumbbell,
  Languages, BookHeart, MapPin, Microscope, Atom, Beaker,
  TrendingUp, Scale, ScrollText,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSubjects, getTopics, getStudentProgress, getStudent } from '../../lib/tauri/commands';
import type { Subject, Topic, StudentProgress, Student } from '../../lib/tauri/commands';

// Subject images
import imgMathematics from '../../assets/subjects/mathematics.jpg';
import imgEnglish from '../../assets/subjects/english.jpg';
import imgBasicScience from '../../assets/subjects/basic-science.jpg';
import imgSocialStudies from '../../assets/subjects/social-studies.jpg';
import imgBasicTechnology from '../../assets/subjects/basic-technology.jpg';
import imgCivicEducation from '../../assets/subjects/civic-education.jpg';
import imgAgriculturalScience from '../../assets/subjects/agricultural-science.jpg';
import imgComputerStudies from '../../assets/subjects/computer-studies.jpg';
import imgHomeEconomics from '../../assets/subjects/home-economics.jpg';
import imgFineArts from '../../assets/subjects/fine-arts.jpg';
import imgMusic from '../../assets/subjects/music.jpg';
import imgPhysicalEducation from '../../assets/subjects/physical-education.jpg';
import imgFrench from '../../assets/subjects/french.jpg';
import imgReligiousStudies from '../../assets/subjects/religious-studies.jpg';
import imgBusinessStudies from '../../assets/subjects/business-studies.jpg';
import imgHistory from '../../assets/subjects/history.jpg';
import imgGeography from '../../assets/subjects/geography.jpg';
import imgBiology from '../../assets/subjects/biology.jpg';
import imgChemistry from '../../assets/subjects/chemistry.jpg';
import imgPhysics from '../../assets/subjects/physics.jpg';
import imgEconomics from '../../assets/subjects/economics.jpg';
import imgGovernment from '../../assets/subjects/government.jpg';
import imgLiterature from '../../assets/subjects/literature.jpg';

// Subject visual configs with background images
const subjectStyles: Record<string, {
  image: string;
  overlay: string;
  icon: React.ElementType;
  accent: string;
}> = {
  Mathematics:          { image: imgMathematics, overlay: 'from-blue-900/80 to-indigo-900/60', icon: Calculator, accent: 'text-blue-500' },
  English:              { image: imgEnglish, overlay: 'from-purple-900/80 to-pink-900/60', icon: BookOpen, accent: 'text-purple-500' },
  'Basic Science':      { image: imgBasicScience, overlay: 'from-emerald-900/80 to-teal-900/60', icon: FlaskConical, accent: 'text-emerald-500' },
  'Social Studies':     { image: imgSocialStudies, overlay: 'from-amber-900/80 to-orange-900/60', icon: Globe, accent: 'text-amber-500' },
  'Basic Technology':   { image: imgBasicTechnology, overlay: 'from-slate-900/80 to-gray-900/60', icon: Wrench, accent: 'text-slate-500' },
  'Civic Education':    { image: imgCivicEducation, overlay: 'from-rose-900/80 to-red-900/60', icon: Landmark, accent: 'text-rose-500' },
  'Agricultural Science': { image: imgAgriculturalScience, overlay: 'from-green-900/80 to-lime-900/60', icon: Leaf, accent: 'text-green-500' },
  'Computer Studies':   { image: imgComputerStudies, overlay: 'from-cyan-900/80 to-blue-900/60', icon: Monitor, accent: 'text-cyan-500' },
  ICT:                  { image: imgComputerStudies, overlay: 'from-cyan-900/80 to-blue-900/60', icon: Monitor, accent: 'text-cyan-500' },
  'Home Economics':     { image: imgHomeEconomics, overlay: 'from-pink-900/80 to-rose-900/60', icon: ShoppingCart, accent: 'text-pink-500' },
  'Fine Arts':          { image: imgFineArts, overlay: 'from-violet-900/80 to-purple-900/60', icon: Palette, accent: 'text-violet-500' },
  'Creative Arts':      { image: imgFineArts, overlay: 'from-violet-900/80 to-purple-900/60', icon: Palette, accent: 'text-violet-500' },
  Music:                { image: imgMusic, overlay: 'from-fuchsia-900/80 to-pink-900/60', icon: MusicIcon, accent: 'text-fuchsia-500' },
  'Physical Education': { image: imgPhysicalEducation, overlay: 'from-orange-900/80 to-red-900/60', icon: Dumbbell, accent: 'text-orange-500' },
  PHE:                  { image: imgPhysicalEducation, overlay: 'from-orange-900/80 to-red-900/60', icon: Dumbbell, accent: 'text-orange-500' },
  French:               { image: imgFrench, overlay: 'from-blue-900/80 to-indigo-900/60', icon: Languages, accent: 'text-blue-400' },
  'Religious Studies':  { image: imgReligiousStudies, overlay: 'from-amber-900/80 to-yellow-900/60', icon: BookHeart, accent: 'text-amber-400' },
  CRS:                  { image: imgReligiousStudies, overlay: 'from-amber-900/80 to-yellow-900/60', icon: BookHeart, accent: 'text-amber-400' },
  IRS:                  { image: imgReligiousStudies, overlay: 'from-amber-900/80 to-yellow-900/60', icon: BookHeart, accent: 'text-amber-400' },
  'Business Studies':   { image: imgBusinessStudies, overlay: 'from-gray-900/80 to-slate-900/60', icon: TrendingUp, accent: 'text-gray-400' },
  History:              { image: imgHistory, overlay: 'from-stone-900/80 to-amber-900/60', icon: ScrollText, accent: 'text-stone-400' },
  Geography:            { image: imgGeography, overlay: 'from-teal-900/80 to-green-900/60', icon: MapPin, accent: 'text-teal-500' },
  Biology:              { image: imgBiology, overlay: 'from-green-900/80 to-emerald-900/60', icon: Microscope, accent: 'text-green-400' },
  Chemistry:            { image: imgChemistry, overlay: 'from-sky-900/80 to-blue-900/60', icon: Beaker, accent: 'text-sky-400' },
  Physics:              { image: imgPhysics, overlay: 'from-indigo-900/80 to-violet-900/60', icon: Atom, accent: 'text-indigo-400' },
  Economics:            { image: imgEconomics, overlay: 'from-emerald-900/80 to-green-900/60', icon: Scale, accent: 'text-emerald-400' },
  Government:           { image: imgGovernment, overlay: 'from-blue-900/80 to-slate-900/60', icon: Landmark, accent: 'text-blue-400' },
  Literature:           { image: imgLiterature, overlay: 'from-rose-900/80 to-pink-900/60', icon: BookOpen, accent: 'text-rose-400' },
  'Literature in English': { image: imgLiterature, overlay: 'from-rose-900/80 to-pink-900/60', icon: BookOpen, accent: 'text-rose-400' },
};

const defaultStyle = {
  image: imgBasicScience,
  overlay: 'from-gray-900/80 to-gray-900/60',
  icon: BookOpen,
  accent: 'text-gray-500',
};

function CircularProgress({ percent, size = 52, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : percent > 0 ? '#ef4444' : '#94a3b8';

  return (
    <svg width={size} height={size} className="transform -rotate-90 drop-shadow-lg">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="fill-white font-bold"
        fontSize={size * 0.24}
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {percent}%
      </text>
    </svg>
  );
}

export default function StudentSubjectsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topicsMap, setTopicsMap] = useState<Record<string, Topic[]>>({});
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        let classLevel: string | undefined;
        if (user?.student_id) {
          try {
            const s = await getStudent(user.student_id);
            setStudentData(s);
            classLevel = s.class_level;
          } catch { /* fallback */ }
          const prog = await getStudentProgress(user.student_id);
          setProgress(prog);
        }
        const subs = await getSubjects(classLevel);
        setSubjects(subs);

        // Pre-load topics
        const topicResults: Record<string, Topic[]> = {};
        await Promise.all(
          subs.map(async (sub) => {
            try {
              topicResults[sub.id] = await getTopics(sub.id);
            } catch { topicResults[sub.id] = []; }
          })
        );
        setTopicsMap(topicResults);
      } catch (err) {
        console.error('Failed to load subjects:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const getSubjectProgress = (subjectId: string) => {
    const topics = topicsMap[subjectId] || [];
    if (topics.length === 0) return { completed: 0, total: 0, avg: 0 };
    const topicIds = new Set(topics.map((t) => t.id));
    const relevant = progress.filter((p) => topicIds.has(p.topic_id));
    const completed = relevant.filter((p) => p.status === 'completed').length;
    const avg = relevant.length > 0
      ? Math.round(relevant.reduce((sum, p) => sum + p.score, 0) / relevant.length)
      : 0;
    return { completed, total: topics.length, avg };
  };

  const getTopicMastery = (topicId: string) => {
    return progress.find((p) => p.topic_id === topicId);
  };

  // Find "continue learning" subject
  const continueSubject = (() => {
    if (progress.length === 0) return null;
    const sorted = [...progress].sort((a, b) =>
      (b.last_accessed || '').localeCompare(a.last_accessed || '')
    );
    const lastTopic = sorted[0];
    for (const sub of subjects) {
      const topics = topicsMap[sub.id] || [];
      if (topics.some((t) => t.id === lastTopic.topic_id)) {
        const lastTopicData = topics.find((t) => t.id === lastTopic.topic_id);
        return { subject: sub, topic: lastTopicData, progress: lastTopic };
      }
    }
    return null;
  })();

  const style = (name: string) => subjectStyles[name] || defaultStyle;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">Loading your subjects...</p>
        </div>
      </div>
    );
  }

  const selected = subjects.find((s) => s.id === selectedSubject);
  const selectedTopics = selectedSubject ? (topicsMap[selectedSubject] || []) : [];
  const selectedStyle = selected ? style(selected.name) : defaultStyle;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Subjects</h1>
        <p className="text-text-secondary mt-1">
          {studentData ? `${studentData.class_level} Curriculum` : 'Your learning journey'}
        </p>
      </div>

      {/* Continue Learning Banner */}
      {continueSubject && !selectedSubject && (() => {
        const s = style(continueSubject.subject.name);
        return (
          <div className="relative rounded-[20px] overflow-hidden h-36">
            <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-r ${s.overlay}`} />
            <div className="relative z-10 h-full flex items-center p-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-white/70" />
                  <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Continue Learning</span>
                </div>
                <h3 className="text-xl font-bold text-white">{continueSubject.subject.name}</h3>
                <p className="text-white/70 text-sm">{continueSubject.topic?.name}</p>
                <button
                  onClick={() => setSelectedSubject(continueSubject.subject.id)}
                  className="mt-3 flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-[12px] text-sm font-medium text-white transition-colors"
                >
                  <Play size={14} />
                  Resume
                </button>
              </div>
              <CircularProgress percent={continueSubject.progress.score} size={64} stroke={5} />
            </div>
          </div>
        );
      })()}

      {/* Back button */}
      {selectedSubject && (
        <button
          onClick={() => setSelectedSubject(null)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit"
        >
          <ChevronRight size={16} className="rotate-180" />
          Back to subjects
        </button>
      )}

      {/* Subject Cards Grid */}
      {!selectedSubject && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {subjects.map((subject) => {
            const s = style(subject.name);
            const Icon = s.icon;
            const prog = getSubjectProgress(subject.id);
            const progressPct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
            const topics = topicsMap[subject.id] || [];

            return (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject.id)}
                className="group text-left rounded-[20px] shadow-card overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image Header */}
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={s.image}
                    alt={subject.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.overlay}`} />

                  {/* Content over image */}
                  <div className="relative z-10 h-full flex flex-col justify-between p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/20 backdrop-blur-sm">
                        <Icon size={22} className="text-white" />
                      </div>
                      <CircularProgress percent={prog.avg || progressPct} />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{subject.name}</h3>
                      <p className="text-white/60 text-sm">{subject.description}</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="bg-white px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                        <Layers size={14} />
                        {topics.length} topics
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                        <CheckCircle size={14} className="text-green-500" />
                        {prog.completed}/{prog.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-sm font-medium">Open</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 w-full h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Topic Detail View */}
      {selectedSubject && selected && (
        <div className="flex flex-col gap-4">
          {/* Subject Header */}
          <div className="relative rounded-[20px] overflow-hidden h-44">
            <img src={selectedStyle.image} alt={selected.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-r ${selectedStyle.overlay}`} />
            <div className="relative z-10 h-full flex items-end p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-white/20 backdrop-blur-sm">
                  {(() => { const Icon = selectedStyle.icon; return <Icon size={28} className="text-white" />; })()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selected.name}</h2>
                  <p className="text-white/70">{selected.class_level} · {selectedTopics.length} topics</p>
                </div>
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="flex flex-col gap-3">
            {selectedTopics.map((topic, index) => {
              const mastery = getTopicMastery(topic.id);
              const masteryLevel = mastery?.mastery_level || 'not_started';
              const score = mastery ? Math.round(mastery.score) : 0;

              const mc = {
                mastered:         { label: 'Mastered',    bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', ring: 'ring-green-500' },
                working_towards:  { label: 'In Progress', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', ring: 'ring-amber-500' },
                needs_attention:  { label: 'Needs Work',  bg: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-600',     ring: 'ring-red-500' },
                not_started:      { label: 'Not Started', bg: 'bg-white border-gray-100',    badge: 'bg-gray-100 text-gray-500',   ring: 'ring-gray-300' },
              }[masteryLevel] || { label: 'Not Started', bg: 'bg-white border-gray-100', badge: 'bg-gray-100 text-gray-500', ring: 'ring-gray-300' };

              return (
                <div
                  key={topic.id}
                  onClick={() => !topic.is_locked && navigate(`/student/subjects/${selectedSubject}/topics/${topic.id}`)}
                  className={`rounded-[16px] border p-4 transition-all ${
                    topic.is_locked
                      ? 'bg-gray-50 border-gray-100 opacity-50'
                      : `${mc.bg} hover:shadow-md cursor-pointer`
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                      topic.is_locked ? 'bg-gray-200'
                        : masteryLevel === 'mastered' ? 'bg-green-500 text-white'
                        : masteryLevel === 'not_started' ? 'bg-gray-200 text-gray-500'
                        : 'bg-gradient-to-r from-primary to-primary/80 text-white'
                    }`}>
                      {topic.is_locked ? <Lock size={16} className="text-gray-400" />
                        : masteryLevel === 'mastered' ? <CheckCircle size={18} />
                        : <span className="text-sm font-bold">{index + 1}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary">{topic.name}</p>
                      {topic.description && (
                        <p className="text-sm text-text-secondary mt-0.5 truncate">{topic.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted">
                        <Clock size={12} />
                        {topic.estimated_minutes}min
                      </span>
                      {mastery && score > 0 && (
                        <span className="text-sm font-bold text-text-primary">{score}%</span>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${mc.badge}`}>
                        {mc.label}
                      </span>
                      {!topic.is_locked && <ChevronRight size={18} className="text-text-muted" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
