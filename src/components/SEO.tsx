import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  keywords?: string;
}

const DEFAULT_TITLE = 'TUCASA STUM';
const DEFAULT_DESCRIPTION = 'TUCASA STUM is an Information Management System for Adventist student associations in Tanzania universities and colleges.';
const DEFAULT_URL = 'https://yourdomain.com';
const DEFAULT_IMAGE = '/PCM-logo.png';
const DEFAULT_KEYWORDS = 'TUCASA, STUM, membership, dashboard, student association, Tanzania';

export function SEO({
  title,
  description,
  image = DEFAULT_IMAGE,
  url = DEFAULT_URL,
  keywords = DEFAULT_KEYWORDS,
}: SEOProps) {
  const fullTitle = `${title} | ${DEFAULT_TITLE}`;
  const isGitHubDevEnvironment = typeof window !== 'undefined' && /(?:app\.github\.dev|github\.dev)/.test(window.location.hostname);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      {!isGitHubDevEnvironment && <link rel="manifest" href="/site.webmanifest" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || DEFAULT_DESCRIPTION} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
