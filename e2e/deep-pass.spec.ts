import { expect, test } from '@playwright/test'
test('effective protocol blocks outdated consent and permits an eligible visit', async ({ page }) => {
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByLabel('Consent version').selectOption('3')
  await expect(page.getByText('Consent v4 must precede the visit.')).toBeVisible()
  await page.getByLabel('Consent version').selectOption('4')
  await page.getByRole('button', { name: 'Record visit' }).click()
  await expect(page.getByRole('status')).toContainText('VIS-6 recorded')
})
