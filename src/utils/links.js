// Every "continue your application" / "view your offers" / "upload your
// documents" link an applicant gets, whether in SendGrid or a reminder
// email, is the same URL — resuming just drops them back wherever
// AppState.stage says they were, so one link covers every case.
const resumeLink = (resumeToken) => {
  if (!resumeToken) return null;
  const protocol = process.env.APP_PROTOCOL || 'http';
  const domain = process.env.APP_DOMAIN || 'localhost:3000';
  return `${protocol}://${domain}/resume/${resumeToken}`;
};

module.exports = { resumeLink };
