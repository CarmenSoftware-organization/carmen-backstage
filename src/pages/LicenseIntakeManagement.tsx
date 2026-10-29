import React from 'react';
import Layout from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { useI18n } from '../hooks/useI18n';

// Placeholder — replaced by the real page in a later task of the license intake plan.
const LicenseIntakeManagement: React.FC = () => {
  const { t } = useI18n();
  return (
    <Layout>
      <PageHeader title={t('nav.licenseIntakes')} />
    </Layout>
  );
};

export default LicenseIntakeManagement;
