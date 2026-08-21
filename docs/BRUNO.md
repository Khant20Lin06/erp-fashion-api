# Bruno Collection

The repository contains a Bruno collection under
`bruno/Fashion ERP`.

## Structure

- `bruno/Fashion ERP/bruno.json`
- `bruno/Fashion ERP/collection.bru`
- `bruno/Fashion ERP/environments/local.bru`
- module folders with representative requests for:
  - Auth
  - RBAC
  - Products
  - Customers
  - Suppliers
  - Purchases
  - Inventory
  - Payments
  - Accounting
  - Reports
  - Notifications
  - Health
  - HR (Assignments, Attendance, Departments, Designations, Employees, Leave)
  - Settings (System, Company, Branch, Me)

## Environment Variables

The committed `local.bru` file uses placeholders only. Fill in values for
your local verification environment:

- `baseUrl`
- `authEmail`
- `authPassword`
- `companyId`
- `branchId`
- `deniedBranchId`
- `deniedCompanyId`
- `warehouseId`
- `deniedWarehouseId`
- `paymentMethodId`
- `customerId`
- `supplierId`
- `accountId`

Do not commit real tokens, passwords, API keys, or infrastructure secrets.

## Authentication Flow

`Auth/01 Login.bru` logs in with the configured credentials, extracts the
JWT from the `fashion_erp_access_token` response cookie, and stores it in
the runtime `accessToken` variable.

Protected requests then use:

```text
Authorization: Bearer {{accessToken}}
```

## Running

If Bruno CLI is installed locally:

```bash
bru run "bruno/Fashion ERP" --env-file "bruno/Fashion ERP/environments/local.bru" -r
```

The CLI is not bundled with this repository, so Phase 25 verification must
report `NOT TESTED` when Bruno CLI is unavailable on the machine.
