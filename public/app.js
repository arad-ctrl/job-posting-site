const meta = document.getElementById("meta");
const jobsContainer = document.getElementById("jobs");
const template = document.getElementById("job-card-template");

const renderJobs = (payload) => {
  jobsContainer.innerHTML = "";

  if (payload.error) {
    meta.textContent = `Last sync: ${new Date(payload.fetchedAt).toLocaleString()} • ${payload.error}`;
    return;
  }

  meta.textContent = `Updated ${new Date(payload.fetchedAt).toLocaleString()} • ${payload.jobs.length} role(s)`;

  payload.jobs.forEach((job) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector("h2").textContent = job.title;
    fragment.querySelector(".details").textContent = `${job.team} • ${job.location} • ${job.type}`;
    fragment.querySelector(".summary").textContent = job.summary;
    jobsContainer.append(fragment);
  });

  if (!payload.jobs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No open roles are published yet.";
    jobsContainer.append(empty);
  }
};

const loadJobs = async () => {
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    renderJobs(payload);
  } catch (error) {
    meta.textContent = `Unable to load jobs: ${error.message}`;
  }
};

loadJobs();
