(() => {
  'use strict';

  const STORAGE_KEY = 'propertyValuationStudio.projects.v1';
  const FORMAT = 'property-valuation-studio-project';
  const VERSION = '1.0';
  const fields = [
    'address', 'propertyType', 'condition', 'bedrooms', 'bathrooms', 'floorArea', 'floorAreaUnit',
    'landSize', 'renovationHistory', 'keyFeatures', 'specialCharacteristics', 'ownersExpectations',
    'additionalNotes', 'assessment', 'buyerProfile', 'preparationPlan', 'sellingPoints',
    'marketingStrategy', 'additionalIdeas'
  ];
  const $ = (id) => document.getElementById(id);
  const form = $('projectForm');
  const status = $('saveStatus');
  const projectSelect = $('projectSelect');
  let projects = [];
  let currentId = null;
  let saveTimer;
  let toastTimer;

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function timestamp() { return new Date().toISOString(); }

  function blankProject(name = '') {
    const now = timestamp();
    return { id: makeId(), name, createdAt: now, updatedAt: null, data: Object.fromEntries(fields.map((key) => [key, ''])) };
  }

  function announce(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  function readFieldValues() {
    const data = {};
    for (const key of fields) data[key] = $(key).value;
    return data;
  }

  function writeFieldValues(data) {
    for (const key of fields) $(key).value = typeof data?.[key] === 'string' ? data[key] : '';
  }

  function getCurrent() { return projects.find((project) => project.id === currentId); }

  function setMeta(project) {
    const date = project.updatedAt ? new Date(project.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not saved yet';
    $('projectMeta').textContent = `Version ${VERSION} · Last saved ${date}`;
  }

  function renderProjectList() {
    projectSelect.replaceChildren();
    for (const project of projects) {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || project.data.address || 'Untitled project';
      projectSelect.append(option);
    }
    projectSelect.value = currentId;
  }

  function renderCurrent() {
    const project = getCurrent();
    if (!project) return;
    writeFieldValues(project.data);
    renderProjectList();
    setMeta(project);
  }

  function persist(showMessage = true) {
    const project = getCurrent();
    if (!project) return false;
    project.data = readFieldValues();
    project.name = project.data.address.trim() || project.name || 'Untitled project';
    project.updatedAt = timestamp();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      renderProjectList();
      setMeta(project);
      announce(`Saved ${new Date(project.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
      if (showMessage) toast('Project saved in this browser.');
      return true;
    } catch (error) {
      announce('Could not save to browser storage', true);
      if (showMessage) toast('Saving failed. Export a JSON copy and check available browser storage.');
      return false;
    }
  }

  function scheduleSave() {
    announce('Unsaved changes');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(false), 450);
  }

  function normaliseImported(input) {
    const candidate = input?.format === FORMAT ? input.project : input;
    if (!candidate || typeof candidate !== 'object' || !candidate.data || typeof candidate.data !== 'object') {
      throw new Error('This file does not contain a recognised Property Valuation Studio project.');
    }
    const data = Object.fromEntries(fields.map((key) => [key, typeof candidate.data[key] === 'string' ? candidate.data[key] : '']));
    return {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : makeId(),
      name: typeof candidate.name === 'string' ? candidate.name.slice(0, 100) : '',
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : timestamp(),
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
      data
    };
  }

  function selectSection(section) {
    const isProperty = section === 'property';
    $('propertySection').hidden = !isProperty;
    $('strategySection').hidden = isProperty;
    document.querySelectorAll('.nav-tab').forEach((button) => {
      const active = button.dataset.section === section;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) projects = parsed.map(normaliseImported);
      }
    } catch (error) {
      projects = [];
      announce('Saved data could not be read', true);
      toast('Browser data could not be read. Import a JSON backup if you have one.');
    }
    if (!projects.length) projects = [blankProject()];
    currentId = projects[0].id;
    renderCurrent();
  }

  $('saveButton').addEventListener('click', () => { clearTimeout(saveTimer); persist(true); });
  form.addEventListener('input', scheduleSave);
  form.addEventListener('change', scheduleSave);

  document.querySelectorAll('.nav-tab').forEach((button) => button.addEventListener('click', () => selectSection(button.dataset.section)));

  projectSelect.addEventListener('change', () => {
    const nextId = projectSelect.value;
    clearTimeout(saveTimer);
    persist(false);
    currentId = nextId;
    renderCurrent();
    announce('Project loaded');
  });

  $('newProjectButton').addEventListener('click', () => {
    $('newProjectName').value = '';
    $('newProjectDialog').showModal();
    $('newProjectName').focus();
  });

  $('newProjectForm').addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'create') return;
    event.preventDefault();
    clearTimeout(saveTimer);
    persist(false);
    const name = $('newProjectName').value.trim();
    const project = blankProject(name);
    projects.unshift(project);
    currentId = project.id;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      $('newProjectDialog').close();
      renderCurrent();
      selectSection('property');
      announce('New project created');
      toast('New project created. Your other projects are still saved.');
    } catch (error) {
      projects.shift();
      currentId = projects[0]?.id || null;
      renderCurrent();
      announce('Could not create project', true);
      toast('Could not save the new project. Check available browser storage.');
    }
  });

  $('exportButton').addEventListener('click', () => {
    clearTimeout(saveTimer);
    persist(false);
    const project = getCurrent();
    const payload = { format: FORMAT, appVersion: VERSION, exportedAt: timestamp(), project };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = (project.name || 'property-project').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'property-project';
    anchor.href = url;
    anchor.download = `${safeName}-valuation-project.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast('Project JSON exported. Keep it as a backup.');
  });

  $('importButton').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      clearTimeout(saveTimer);
      persist(false);
      const imported = normaliseImported(JSON.parse(await file.text()));
      if (projects.some((project) => project.id === imported.id)) imported.id = makeId();
      const nextProjects = [imported, ...projects];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));
      projects = nextProjects;
      currentId = imported.id;
      renderCurrent();
      selectSection('property');
      announce('Project imported');
      toast('Project imported and saved in this browser.');
    } catch (error) {
      announce('Import failed', true);
      toast(error instanceof SyntaxError ? 'The selected file is not valid JSON.' : error.message || 'Could not import this file.');
    } finally {
      event.target.value = '';
    }
  });

  loadFromStorage();
})();
