import { expect, test } from '@playwright/test'

test('protocol amendment invalidates and then revalidates next-visit authorization', async ({ page }) => {
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByRole('button', { name: 'Record visit' }).click()
  await page.goto('/studies/TF-201/subjects/S-014/readiness')
  await page.getByRole('button', { name: 'Authorize next visit' }).click()
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByRole('button', { name: 'Record protocol amendment' }).click()
  await page.goto('/studies/TF-201/subjects/S-014/readiness')
  await expect(page.getByText('superseded protocol', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Authorize next visit' })).toBeDisabled()
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByRole('button', { name: 'Revalidate Visit 6' }).click()
  await page.goto('/studies/TF-201/subjects/S-014/readiness')
  await page.getByRole('button', { name: 'Authorize next visit' }).click()
  await expect(page.getByText('Next visit authorized')).toBeVisible()
})
