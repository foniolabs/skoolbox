import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Users, Plus, Check, AlertCircle } from 'lucide-react';
import { getAllUsers, enrollStudents, deleteUser } from '../lib/tauri/commands';
import type { User } from '../lib/tauri/commands';
import CustomDropdown from '../components/shared/CustomDropdown';
import Button from '../components/shared/Button';

const classLevelOptions = [
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
];

interface NewStudent {
  fullName: string;
  username: string;
  classLevel: string;
}

export default function EnrollStudentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState('student123');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [newStudents, setNewStudents] = useState<NewStudent[]>([
    { fullName: '', username: '', classLevel: 'Pry 5' },
  ]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    setNewStudents((prev) => [...prev, { fullName: '', username: '', classLevel: 'Pry 5' }]);
  };

  const removeRow = (index: number) => {
    setNewStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof NewStudent, value: string) => {
    setNewStudents((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        // Auto-generate username from full name
        if (field === 'fullName') {
          updated.username = value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
        }
        return updated;
      })
    );
  };

  const handleEnroll = async () => {
    const validStudents = newStudents.filter((s) => s.fullName.trim() && s.username.trim());
    if (validStudents.length === 0) {
      setErrorMsg('Please fill in at least one student');
      return;
    }

    setEnrolling(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const data: [string, string, string][] = validStudents.map((s) => [
        s.fullName.trim(),
        s.username.trim(),
        s.classLevel,
      ]);
      const enrolled = await enrollStudents(data, defaultPassword);
      setSuccessMsg(`Successfully enrolled ${enrolled.length} student(s)!`);
      setNewStudents([{ fullName: '', username: '', classLevel: 'Pry 5' }]);
      await loadUsers();
    } catch (err) {
      setErrorMsg('Failed to enroll students. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the system?`)) return;
    try {
      await deleteUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const studentUsers = users.filter((u) => u.role === 'student');

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserPlus className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">Enroll Students</h1>
      </div>

      {/* Bulk Enrollment Form */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Add New Students</h2>

        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_140px_40px] gap-3 text-sm font-medium text-text-secondary">
            <span>Full Name</span>
            <span>Username</span>
            <span>Class</span>
            <span></span>
          </div>

          {/* Student rows */}
          {newStudents.map((student, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_140px_40px] gap-3">
              <input
                type="text"
                value={student.fullName}
                onChange={(e) => updateRow(index, 'fullName', e.target.value)}
                placeholder="e.g. Chika Obi"
                className="px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={student.username}
                onChange={(e) => updateRow(index, 'username', e.target.value)}
                placeholder="auto-generated"
                className="px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <CustomDropdown
                options={classLevelOptions}
                value={student.classLevel}
                onChange={(v) => updateRow(index, 'classLevel', v)}
              />
              {newStudents.length > 1 && (
                <button
                  onClick={() => removeRow(index)}
                  className="flex items-center justify-center h-10 w-10 rounded-[12px] text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="flex items-center gap-1.5 mt-3 text-sm text-primary font-medium hover:underline"
        >
          <Plus size={16} />
          Add another student
        </button>

        {/* Default password */}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-text-secondary whitespace-nowrap">Default password:</label>
          <input
            type="text"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            className="px-3 py-2 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary w-48 focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-text-muted">Students can change it later</span>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-[12px] border border-green-200">
            <Check size={16} />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-[12px] border border-red-200">
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        <div className="mt-4">
          <Button onClick={handleEnroll} disabled={enrolling} className="flex items-center gap-2">
            <UserPlus size={16} />
            {enrolling ? 'Enrolling...' : 'Enroll Students'}
          </Button>
        </div>
      </div>

      {/* Enrolled Students List */}
      <div className="bg-white rounded-[20px] shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">
            Enrolled Students ({studentUsers.length})
          </h2>
        </div>

        {loading ? (
          <p className="text-text-muted text-center py-6">Loading...</p>
        ) : studentUsers.length === 0 ? (
          <p className="text-text-muted text-center py-6">No students enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-text-secondary font-medium">Name</th>
                  <th className="text-left py-2 text-text-secondary font-medium">Username</th>
                  <th className="text-left py-2 text-text-secondary font-medium">Joined</th>
                  <th className="text-right py-2 text-text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-bg-secondary/30">
                    <td className="py-3 font-medium text-text-primary">{user.full_name}</td>
                    <td className="py-3 text-text-secondary">@{user.username}</td>
                    <td className="py-3 text-text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
