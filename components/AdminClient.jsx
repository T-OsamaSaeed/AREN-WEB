'use client';

import { useState } from 'react';
import { getCurrentWeekKey } from '../lib/utils/week';

function getErrorMessage(error) {
  return error?.message || JSON.stringify(error);
}

export default function AdminClient() {
  const [password, setPassword] = useState('');
  const [weekKey, setWeekKey] = useState(getCurrentWeekKey());
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    body: '',
  });

  async function loadReport(event) {
    event?.preventDefault();
    setStatus('Rapor yükleniyor...');
    setError('');

    try {
      const response = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, weekKey }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Rapor yüklenemedi');
      }

      setReport(result.report);
      setStatus('Rapor yüklendi');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setStatus('');
    }
  }

  async function createAnnouncement(event) {
    event.preventDefault();
    setStatus('Duyuru kaydediliyor...');
    setError('');

    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...announcementForm }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Duyuru kaydedilemedi');
      }

      setAnnouncementForm({
        date: new Date().toISOString().slice(0, 10),
        title: '',
        body: '',
      });
      setStatus('Duyuru kaydedildi');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      setStatus('');
    }
  }

  return (
    <main className="dashboard-shell shell">
      <section className="content-card">
        <div className="content-header">
          <div>
            <p className="section-kicker">Admin</p>
            <h1 className="section-title">Haftalık rapor</h1>
          </div>
        </div>

        <form className="form-stack" onSubmit={loadReport}>
          <input
            className="input"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin şifresi"
            type="password"
            value={password}
          />
          <input
            className="input"
            onChange={(event) => setWeekKey(event.target.value)}
            placeholder="Hafta anahtarı"
            value={weekKey}
          />
          <button className="button button-primary" type="submit">
            Raporu getir
          </button>
        </form>

        {status ? <p className="status status-success">{status}</p> : null}
        {error ? <p className="status status-error">{error}</p> : null}
      </section>

      {report ? (
        <section className="content-card">
          <div className="content-header">
            <div>
              <p className="section-kicker">{report.week_key}</p>
              <h2 className="section-title">Arama özeti</h2>
            </div>
          </div>

          <div className="admin-grid">
            {report.summary_by_teacher.map((summary) => (
              <article className="report-card" key={summary.teacher_name}>
                <h3 className="card-title">{summary.teacher_name}</h3>
                <p className="status">Atanan: {summary.total_assigned_calls}</p>
                <p className="status">Arama: {summary.total_call_actions}</p>
                <p className="status">WhatsApp: {summary.total_whatsapp_actions}</p>
                <p className="status">Not: {summary.total_notes}</p>
                <p className="status">Ulaşılmayan: {summary.not_contacted_students}</p>
              </article>
            ))}
          </div>

          <div className="report-table">
            {report.rows.map((row) => (
              <article className="report-card" key={`${row.teacher_name}-${row.student_name}-${row.week_key}`}>
                <h3 className="card-title">{row.student_name}</h3>
                <p className="status">{row.teacher_name}</p>
                <p className="status">{row.phone_number || 'Telefon yok'}</p>
                <p className="status">Durum: {row.weekly_status}</p>
                <p className="status">Son işlem: {row.last_action_type || 'Yok'} {row.last_action_time || ''}</p>
                <p className="status">Not: {row.note || 'Yok'}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="content-card">
        <div className="content-header">
          <div>
            <p className="section-kicker">Duyurular</p>
            <h2 className="section-title">Duyuru ekle</h2>
          </div>
        </div>

        <form className="form-stack" onSubmit={createAnnouncement}>
          <input
            className="input"
            onChange={(event) => setAnnouncementForm((current) => ({ ...current, date: event.target.value }))}
            type="date"
            value={announcementForm.date}
          />
          <input
            className="input"
            onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Başlık"
            value={announcementForm.title}
          />
          <textarea
            className="textarea"
            onChange={(event) => setAnnouncementForm((current) => ({ ...current, body: event.target.value }))}
            placeholder="Duyuru metni"
            value={announcementForm.body}
          />
          <button className="button button-primary" type="submit">
            Duyuruyu kaydet
          </button>
        </form>
      </section>
    </main>
  );
}
