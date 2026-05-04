'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function formatPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

function formatSupabaseError(error) {
  return {
    message: error?.message || 'Unknown Supabase error',
    details: error?.details || null,
    hint: error?.hint || null,
    code: error?.code || null,
  };
}

export default function SupabaseTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('Henüz test yapılmadı.');

  const debugInfo = {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlPreview: supabaseUrl ? supabaseUrl.slice(0, 30) : 'missing',
  };

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }, []);

  function requireClient() {
    if (!supabase) {
      throw new Error(
        'Supabase client could not be created. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }

    return supabase;
  }

  async function runTest(label, callback) {
    setIsLoading(true);
    setResult(`${label} çalışıyor...`);

    try {
      const data = await callback(requireClient());
      setResult(formatPayload({ success: true, data }));
    } catch (error) {
      console.error(`${label} failed:`, error);
      setResult(formatPayload({ success: false, error: error?.message || String(error), fullError: error }));
    } finally {
      setIsLoading(false);
    }
  }

  function handleReadTeachers() {
    runTest('Test Read Teachers', async (client) => {
      const { data, error } = await client
        .from('teachers')
        .select('teacher_name, subject_area')
        .limit(5);

      console.log('Test Read Teachers result:', { data, error });

      if (error) {
        console.error('Test Read Teachers Supabase error:', error);
        throw new Error(formatPayload(formatSupabaseError(error)));
      }

      return data;
    });
  }

  function handleWriteNote() {
    runTest('Test Write Note', async (client) => {
      const { data, error } = await client
        .from('weekly_call_notes')
        .upsert(
          {
            teacher_name: 'GÖKHAN HOCA',
            student_name: 'SUPABASE TEST STUDENT',
            phone_number: '0000000000',
            week_key: 'TEST-WEEK',
            note: 'This note was written from /supabase-test page',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'teacher_name,student_name,week_key',
          },
        )
        .select();

      console.log('Test Write Note result:', { data, error });

      if (error) {
        console.error('Test Write Note Supabase error:', error);
        throw new Error(formatPayload(formatSupabaseError(error)));
      }

      if (!data || data.length === 0) {
        throw new Error('Supabase returned no data after writing the test note.');
      }

      return data;
    });
  }

  function handleWriteActivity() {
    runTest('Test Write Activity', async (client) => {
      const { data, error } = await client
        .from('call_activity_log')
        .insert({
          teacher_name: 'GÖKHAN HOCA',
          student_name: 'SUPABASE TEST STUDENT',
          phone_number: '0000000000',
          week_key: 'TEST-WEEK',
          action_type: 'call',
          action_time: new Date().toISOString(),
        })
        .select();

      console.log('Test Write Activity result:', { data, error });

      if (error) {
        console.error('Test Write Activity Supabase error:', error);
        throw new Error(formatPayload(formatSupabaseError(error)));
      }

      if (!data || data.length === 0) {
        throw new Error('Supabase returned no data after writing the test activity.');
      }

      return data;
    });
  }

  return (
    <main className="shell" style={{ maxWidth: 760, padding: '34px 0 70px' }}>
      <section className="content-card" style={{ display: 'grid', gap: 18 }}>
        <div>
          <p className="section-kicker">Supabase Test</p>
          <h1 className="section-title">Bağlantı testi</h1>
        </div>

        <div className="debug-box" style={{ fontSize: '0.95rem' }}>
          <div>Supabase URL exists: {debugInfo.hasUrl ? 'yes' : 'no'}</div>
          <div>Supabase anon key exists: {debugInfo.hasAnonKey ? 'yes' : 'no'}</div>
          <div>Supabase URL preview: {debugInfo.urlPreview}</div>
        </div>

        <div className="form-stack">
          <button className="button button-primary" disabled={isLoading} onClick={handleReadTeachers} type="button">
            Test Read Teachers
          </button>
          <button className="button button-primary" disabled={isLoading} onClick={handleWriteNote} type="button">
            Test Write Note
          </button>
          <button className="button button-primary" disabled={isLoading} onClick={handleWriteActivity} type="button">
            Test Write Activity
          </button>
        </div>

        <pre
          className="debug-box"
          style={{
            minHeight: 180,
            margin: 0,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {result}
        </pre>
      </section>
    </main>
  );
}
