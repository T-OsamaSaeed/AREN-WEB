'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandLogo from './BrandLogo';
import { getTeachers } from '../lib/data/academy';
import { normalizeTeacherName } from '../lib/constants/teachers';

const TEACHER_STORAGE_KEY = 'aren-academy-current-teacher';

export function getStoredTeacherName() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(TEACHER_STORAGE_KEY) || '';
}

export function storeTeacherName(teacherName) {
  window.localStorage.setItem(TEACHER_STORAGE_KEY, teacherName);
}

export function clearStoredTeacherName() {
  window.localStorage.removeItem(TEACHER_STORAGE_KEY);
}

export default function TeacherLogin() {
  const router = useRouter();
  const [teacherInput, setTeacherInput] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedTeacherName = getStoredTeacherName();
    if (storedTeacherName) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;

    async function loadTeachers() {
      try {
        const teacherRows = await getTeachers();
        if (!cancelled) {
          setTeachers(teacherRows);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Öğretmen listesi yüklenemedi.');
          setStatus('error');
        }
      }
    }

    loadTeachers();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const matchedTeacher = teachers.find(
      (teacher) => normalizeTeacherName(teacher.teacher_name) === normalizeTeacherName(teacherInput),
    );

    if (!matchedTeacher) {
      setError('Bu aktif öğretmen bulunamadı. Lütfen adı kontrol edin.');
      return;
    }

    storeTeacherName(matchedTeacher.teacher_name);
    router.push('/dashboard');
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <BrandLogo variant="login" />
        <div>
          <p className="eyebrow">ÖĞRETMEN GİRİŞİ</p>
          <h1 className="title">Adınızı girin</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <input
            className="input"
            disabled={status === 'loading'}
            onChange={(event) => setTeacherInput(event.target.value)}
            placeholder="Öğretmen adı"
            value={teacherInput}
          />
          <button className="button button-primary" disabled={status === 'loading'} type="submit">
            {status === 'loading' ? 'Yükleniyor...' : 'Giriş yap'}
          </button>
          {error ? <p className="status status-error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
