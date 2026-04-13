FILENAME: src/App.jsx
LOCATION: src/ folder
CONTENT:

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

const JobAggregator = () => {
  const [tab, setTab] = useState('setup');
  const [loading, setLoading] = useState(false);
  
  const [profile, setProfile] = useState({
    id: null,
    name: '',
    email: '',
    resume_text: '',
    target_roles: [],
    locations: [],
    min_salary: '',
    years_experience: ''
  });
  
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  
  const [filters, setFilters] = useState({
    location: 'all',
    minSalary: '',
    atsSource: 'all'
  });

  const targetRoleOptions = [
    'Web Developer', 'Full Stack Developer', 'AI Automation', 
    'Marketing Automation', 'CRM Developer', 'SEO Specialist', 
    'Graphic Designer', 'Video Editor', 'Copywriter', 'Email Marketing'
  ];
  
  const locationOptions = [
    'Remote', 'Dubai', 'Abu Dhabi', 'Sydney', 'Melbourne', 
    'Toronto', 'Vancouver', 'London', 'Manchester'
  ];
  
  const atsOptions = [
    'All', 'Workday', 'Greenhouse', 'iCIMS', 'Taleo', 
    'Jobvite', 'Recruitee', 'Ashby'
  ];

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (tab === 'jobs' && jobs.length === 0) {
      loadJobs();
    }
  }, [tab]);

  useEffect(() => {
    filterJobs();
  }, [filters, jobs]);

  async function loadProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single();
      
      if (data) {
        setProfile(data);
        setTab('jobs');
      }
    } catch (error) {
      console.log('No existing profile');
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const profileData = {
        name: profile.name,
        email: profile.email,
        resume_text: profile.resume_text,
        target_roles: profile.target_roles,
        locations: profile.locations,
        min_salary: profile.min_salary ? parseInt(profile.min_salary) : null,
        years_experience: profile.years_experience ? parseInt(profile.years_experience) : null
      };

      let result;
      if (profile.id) {
        result = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', profile.id)
          .select();
      } else {
        result = await supabase
          .from('profiles')
          .insert([profileData])
          .select();
      }

      if (result.error) throw result.error;
      
      setProfile(result.data[0]);
      setTab('jobs');
      await loadJobs();
    } catch (error) {
      alert('Error saving profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('posted_date', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  }

  async function loadApplications() {
    if (!profile.id) return;
    
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('profile_id', profile.id)
        .order('applied_date', { ascending: false });
      
      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  }

  function filterJobs() {
    let filtered = jobs;

    if (filters.location !== 'all') {
      filtered = filtered.filter(j => j.location === filters.location);
    }

    if (filters.minSalary) {
      filtered = filtered.filter(j => 
        j.salary_min && j.salary_min >= parseInt(filters.minSalary)
      );
    }

    if (filters.atsSource !== 'all') {
      filtered = filtered.filter(j => 
        j.ats_source?.toLowerCase() === filters.atsSource.toLowerCase()
      );
    }

    setFilteredJobs(filtered);
  }

  async function applyForJob(job) {
    if (!profile.id) {
      alert('Please set up your profile first');
      return;
    }

    try {
      const { error } = await supabase
        .from('applications')
        .insert([{
          profile_id: profile.id,
          job_id: job.id,
          status: 'applied',
          applied_date: new Date().toISOString().split('T')[0]
        }]);

      if (error) {
        if (error.code === '23505') {
          alert('You already applied to this job');
        } else {
          throw error;
        }
      } else {
        alert('Application saved!');
        loadApplications();
      }
    } catch (error) {
      alert('Error applying: ' + error.message);
    }
  }

  async function generateCoverLetter(application) {
    try {
      setLoading(true);
      
      const prompt = `Generate a professional cover letter for this job application. 
Resume: "${profile.resume_text}"
Job Title: ${application.jobs.title}
Company: ${application.jobs.company}
Job Description: ${application.jobs.description}
Keep it under 300 words and highly personalized.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_CLAUDE_API_KEY
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const coverLetterText = data.content?.[0]?.text || 'Error generating cover letter';

      const { error } = await supabase
        .from('applications')
        .update({ cover_letter: coverLetterText })
        .eq('id', application.id);

      if (error) throw error;
      
      loadApplications();
    } catch (error) {
      alert('Error generating cover letter: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateApplicationStatus(applicationId, newStatus) {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;
      loadApplications();
    } catch (error) {
      alert('Error updating status: ' + error.message);
    }
  }

  function handleProfileChange(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  function toggleArrayField(field, value) {
    setProfile(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  }

  // SETUP TAB
  if (tab === 'setup') {
    return (
      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '2rem' }}>OpenPostings</h1>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '2rem' }}>Fresh jobs from 10+ ATS systems. No Indeed. No LinkedIn.</p>
        
        <form onSubmit={saveProfile}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem' }}>Name</label>
            <input 
              type="text" 
              value={profile.name} 
              onChange={(e) => handleProfileChange('name', e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem' }}>Email</label>
            <input 
              type="email" 
              value={profile.email} 
              onChange={(e) => handleProfileChange('email', e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem' }}>Your resume/experience summary</label>
            <textarea 
              value={profile.resume_text} 
              onChange={(e) => handleProfileChange('resume_text', e.target.value)}
              required
              placeholder="Paste your key skills, experience, achievements"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.75rem' }}>Target roles</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {targetRoleOptions.map(role => (
                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={profile.target_roles.includes(role)}
                    onChange={() => toggleArrayField('target_roles', role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.75rem' }}>Preferred locations</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {locationOptions.map(loc => (
                <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={profile.locations.includes(loc)}
                    onChange={() => toggleArrayField('locations', loc)}
                  />
                  {loc}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem' }}>Min salary (USD)</label>
              <input 
                type="number" 
                value={profile.min_salary} 
                onChange={(e) => handleProfileChange('min_salary', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '0.5rem' }}>Years experience</label>
              <input 
                type="number" 
                value={profile.years_experience} 
                onChange={(e) => handleProfileChange('years_experience', e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              fontWeight: 600, 
              borderRadius: '8px', 
              border: 'none', 
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '14px'
            }}
          >
            {loading ? 'Saving...' : 'Start browsing jobs'}
          </button>
        </form>
      </div>
    );
  }

  // JOBS TAB
  if (tab === 'jobs') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
          {['jobs', 'applications', 'cover'].map(t => (
            <button 
              key={t}
              onClick={() => { setTab(t); if (t === 'applications') loadApplications(); }}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: tab === t ? '#f0f0f0' : 'transparent', 
                border: 'none', 
                cursor: 'pointer', 
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              {t === 'jobs' ? 'Available' : t === 'applications' ? 'Applications' : 'Cover Letters'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>Filters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>Location</label>
              <select 
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
              >
                <option value="all">All locations</option>
                {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>Min salary (USD)</label>
              <input 
                type="number" 
                value={filters.minSalary}
                onChange={(e) => setFilters(prev => ({ ...prev, minSalary: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>ATS source</label>
              <select 
                value={filters.atsSource}
                onChange={(e) => setFilters(prev => ({ ...prev, atsSource: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
              >
                {atsOptions.map(ats => <option key={ats} value={ats}>{ats}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <p style={{ fontSize: '13px', color: '#888' }}>{filteredJobs.length} jobs available</p>
          {filteredJobs.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#999', padding: '2rem' }}>No jobs available yet. Fresh jobs will appear soon.</p>
          ) : (
            filteredJobs.map(job => (
              <div 
                key={job.id}
                style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#f9f9f9', 
                  border: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '0.25rem' }}>{job.title}</h3>
                  <p style={{ fontSize: '13px', color: '#666', marginBottom: '0.75rem' }}>{job.company} · {job.location}</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', color: '#999', marginBottom: '0.5rem' }}>
                    {job.salary_min && <span>${job.salary_min.toLocaleString()}</span>}
                    <span>{job.ats_source}</span>
                    <span>{job.posted_date}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#555' }}>{job.description?.substring(0, 200)}...</p>
                </div>
                <button
                  onClick={() => applyForJob(job)}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Apply
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // APPLICATIONS TAB
  if (tab === 'applications') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
          {['jobs', 'applications', 'cover'].map(t => (
            <button 
              key={t}
              onClick={() => { setTab(t); if (t === 'applications') loadApplications(); }}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: tab === t ? '#f0f0f0' : 'transparent', 
                border: 'none', 
                cursor: 'pointer', 
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              {t === 'jobs' ? 'Available' : t === 'applications' ? 'Applications' : 'Cover Letters'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <p style={{ fontSize: '13px', color: '#888' }}>{applications.length} applications</p>
          {applications.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#999', padding: '2rem' }}>No applications yet. Start applying from the Available jobs tab.</p>
          ) : (
            applications.map(app => (
              <div 
                key={app.id}
                style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#f9f9f9', 
                  border: '1px solid #eee'
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '0.25rem' }}>{app.jobs?.title}</h3>
                  <p style={{ fontSize: '13px', color: '#666' }}>{app.jobs?.company} · Applied {app.applied_date}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['applied', 'interview', 'offer', 'rejected'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateApplicationStatus(app.id, status)}
                      style={{ 
                        padding: '0.4rem 0.8rem', 
                        backgroundColor: app.status === status ? '#4CAF50' : '#eee',
                        color: app.status === status ? 'white' : '#666',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // COVER LETTERS TAB
  if (tab === 'cover') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
          {['jobs', 'applications', 'cover'].map(t => (
            <button 
              key={t}
              onClick={() => { setTab(t); if (t === 'applications') loadApplications(); }}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: tab === t ? '#f0f0f0' : 'transparent', 
                border: 'none', 
                cursor: 'pointer', 
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              {t === 'jobs' ? 'Available' : t === 'applications' ? 'Applications' : 'Cover Letters'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {applications.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#999', padding: '2rem' }}>No applications yet. Apply to jobs first.</p>
          ) : (
            applications.map(app => (
              <div 
                key={app.id}
                style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  backgroundColor: '#f9f9f9', 
                  border: '1px solid #eee'
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{app.jobs?.title}</h3>
                  <p style={{ fontSize: '13px', color: '#666' }}>{app.jobs?.company}</p>
                </div>
                {app.cover_letter ? (
                  <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto', border: '1px solid #ddd' }}>
                    {app.cover_letter}
                  </div>
                ) : (
                  <button
                    onClick={() => generateCoverLetter(app)}
                    disabled={loading}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loading ? 'wait' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    {loading ? 'Generating...' : 'Generate cover letter'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
};

export default JobAggregator;
