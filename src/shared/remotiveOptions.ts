export interface RemotiveCategory {
  slug: string;
  name: string;
}

// From https://remotive.com/api/remote-jobs/categories
export const REMOTIVE_CATEGORIES: RemotiveCategory[] = [
  { slug: 'software-development', name: 'Software Development' },
  { slug: 'engineering', name: 'Engineering' },
  { slug: 'artificial-intelligence', name: 'Artificial Intelligence' },
  { slug: 'data', name: 'Data and Analytics' },
  { slug: 'devops', name: 'Devops' },
  { slug: 'information-technology', name: 'Information Technology' },
  { slug: 'qa', name: 'Quality Assurance' },
  { slug: 'design', name: 'Design' },
  { slug: 'product', name: 'Product Management' },
  { slug: 'project-management', name: 'Project Management' },
  { slug: 'marketing', name: 'Marketing' },
  { slug: 'communications', name: 'Communications' },
  { slug: 'sales', name: 'Sales' },
  { slug: 'business-development', name: 'Business Development' },
  { slug: 'account-management', name: 'Account Management' },
  { slug: 'customer-service', name: 'Customer Service' },
  { slug: 'finance', name: 'Finance' },
  { slug: 'legal', name: 'Legal' },
  { slug: 'compliance', name: 'Compliance' },
  { slug: 'human-resources', name: 'Human Resources' },
  { slug: 'writing', name: 'Writing' },
  { slug: 'education', name: 'Teaching' },
  { slug: 'medical', name: 'Medical' },
  { slug: 'operations', name: 'Operations' },
  { slug: 'research', name: 'Research' },
  { slug: 'strategy', name: 'Strategy' },
  { slug: 'supply-chain', name: 'Supply Chain' },
  { slug: 'knowledge-management', name: 'Knowledge Management' },
  { slug: 'travel-hospitality', name: 'Travel and Hospitality' },
  { slug: 'all-others', name: 'All others' },
];
