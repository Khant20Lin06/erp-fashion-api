param(
  [string]$BaseUrl = 'http://localhost:4100/api/v1',
  [string]$Email = 'admin@fashionerp.com',
  [string]$Password = 'Admin-12345678!'
)

$ErrorActionPreference = 'Stop'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body = $null,
    [hashtable]$Headers = @{}
  )

  $params = @{
    Method      = $Method
    Uri         = $Uri
    WebSession  = $session
    ErrorAction = 'Stop'
    Headers     = $Headers
  }

  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = $Body | ConvertTo-Json -Depth 20
  }

  Invoke-RestMethod @params
}

function Assert-True {
  param(
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-CompanyContext {
  $companies = Invoke-ApiJson -Method Get -Uri "$BaseUrl/companies?limit=100"
  $company = @($companies.data | Where-Object { $_.code -eq 'FASHION-ENT-MAIN' })[0]
  Assert-True ($null -ne $company) 'FASHION-ENT-MAIN company was not found.'

  $companyId = $company.id
  $suppliers = Invoke-ApiJson -Method Get -Uri "$BaseUrl/suppliers?companyId=$companyId&limit=100"
  $paymentMethods = Invoke-ApiJson -Method Get -Uri "$BaseUrl/payment-methods?companyId=$companyId&limit=100"
  $warehouses = Invoke-ApiJson -Method Get -Uri "$BaseUrl/warehouses?companyId=$companyId&limit=100"
  $products = Invoke-ApiJson -Method Get -Uri "$BaseUrl/products?companyId=$companyId&limit=100"

  $supplier = @($suppliers.data | Where-Object { $_.status -eq 'ACTIVE' -and $_.payableAccountId })[0]
  $paymentMethod = @($paymentMethods.data | Where-Object { $_.status -eq 'ACTIVE' -and $_.code -eq 'PM-CASH' })[0]
  $warehouse = @($warehouses.data | Where-Object { $_.status -eq 'ACTIVE' })[0]
  $product = @($products.data | Where-Object { $_.status -eq 'ACTIVE' })[0]

  Assert-True ($null -ne $supplier) 'No active supplier with payableAccountId was found.'
  Assert-True ($null -ne $paymentMethod) 'No active PM-CASH payment method was found.'
  Assert-True ($null -ne $warehouse) 'No active warehouse was found.'
  Assert-True ($null -ne $product) 'No active product was found.'

  $variants = Invoke-ApiJson -Method Get -Uri "$BaseUrl/products/$($product.id)/variants?companyId=$companyId&limit=100"
  $variant = @($variants.data | Where-Object { $_.status -eq 'ACTIVE' })[0]
  Assert-True ($null -ne $variant) 'No active product variant was found.'

  [pscustomobject]@{
    Company = $company
    Supplier = $supplier
    PaymentMethod = $paymentMethod
    Warehouse = $warehouse
    Product = $product
    Variant = $variant
  }
}

function Wait-PurchaseInvoice {
  param(
    [Parameter(Mandatory = $true)][string]$CompanyId,
    [Parameter(Mandatory = $true)][string]$SupplierId,
    [Parameter(Mandatory = $true)][string]$PurchaseOrderId
  )

  for ($attempt = 1; $attempt -le 5; $attempt++) {
    $response = Invoke-ApiJson -Method Get -Uri "$BaseUrl/purchase-invoices?companyId=$CompanyId&supplierId=$SupplierId&limit=100"
    $invoice = @($response.data | Where-Object { $_.purchaseOrderId -eq $PurchaseOrderId })[0]
    if ($null -ne $invoice) {
      return $invoice
    }
    Start-Sleep -Milliseconds 300
  }

  throw "Purchase invoice for purchase order $PurchaseOrderId was not created."
}

function New-ReleasedPurchaseOrder {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][string]$ScenarioTag,
    [Parameter(Mandatory = $true)][string]$UnitCost,
    [int]$Quantity = 1
  )

  $createBody = @{
    companyId = $Context.Company.id
    supplierId = $Context.Supplier.id
    paymentTermId = $Context.Supplier.paymentTermId
    warehouseId = $Context.Warehouse.id
    currency = 'USD'
    notes = "smoke-$ScenarioTag"
    items = @(
      @{
        productVariantId = $Context.Variant.id
        quantity = $Quantity
        unitCost = $UnitCost
        discountAmount = '0.00'
        taxAmount = '0.00'
      }
    )
  }

  $po = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders" -Body $createBody
  $submitted = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders/$($po.id)/submit?companyId=$($Context.Company.id)" -Body @{}
  Assert-True ($submitted.status -eq 'SUBMITTED') "Purchase order $($po.id) did not move to SUBMITTED."

  $approved = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders/$($po.id)/approve?companyId=$($Context.Company.id)" -Body @{}
  Assert-True ($approved.status -eq 'APPROVED') "Purchase order $($po.id) did not move to APPROVED."

  [pscustomobject]@{
    PurchaseOrder = $approved
    PurchaseOrderItem = @($approved.items)[0]
  }
}

function Receive-PurchaseOrder {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)]$ReleasedPurchaseOrder,
    [Parameter(Mandatory = $true)][string]$ScenarioTag,
    [int]$ReceivedQuantity = 1
  )

  $body = @{
    companyId = $Context.Company.id
    purchaseOrderId = $ReleasedPurchaseOrder.PurchaseOrder.id
    warehouseId = $Context.Warehouse.id
    notes = "receipt-$ScenarioTag"
    items = @(
      @{
        purchaseOrderItemId = $ReleasedPurchaseOrder.PurchaseOrderItem.id
        productVariantId = $Context.Variant.id
        receivedQuantity = $ReceivedQuantity
        rejectedQuantity = 0
      }
    )
  }

  Invoke-ApiJson -Method Post -Uri "$BaseUrl/goods-receipts" -Body $body
}

function Post-InvoiceForPurchaseOrder {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][string]$PurchaseOrderId
  )

  $invoice = Wait-PurchaseInvoice -CompanyId $Context.Company.id -SupplierId $Context.Supplier.id -PurchaseOrderId $PurchaseOrderId
  Assert-True ($invoice.status -eq 'DRAFT') "Purchase invoice $($invoice.id) did not start in DRAFT."

  $posted = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-invoices/$($invoice.id)/post?companyId=$($Context.Company.id)" -Body @{}
  Assert-True ($posted.status -eq 'POSTED') "Purchase invoice $($invoice.id) did not move to POSTED."
  $posted
}

function Create-PaymentForInvoice {
  param(
    [Parameter(Mandatory = $true)]$Context,
    [Parameter(Mandatory = $true)][string]$InvoiceId,
    [Parameter(Mandatory = $true)][string]$Amount,
    [Parameter(Mandatory = $true)][string]$ScenarioTag
  )

  $headers = @{ 'Idempotency-Key' = [guid]::NewGuid().Guid }
  $body = @{
    companyId = $Context.Company.id
    direction = 'PAYMENT'
    supplierId = $Context.Supplier.id
    paymentMethodId = $Context.PaymentMethod.id
    amount = $Amount
    currency = 'USD'
    reference = "smoke-$ScenarioTag"
    allocations = @(
      @{
        referenceType = 'PURCHASE_INVOICE'
        referenceId = $InvoiceId
        allocatedAmount = $Amount
      }
    )
  }

  $payment = Invoke-ApiJson -Method Post -Uri "$BaseUrl/payments" -Body $body -Headers $headers
  Assert-True ($payment.status -eq 'CONFIRMED') "Payment $($payment.id) did not return CONFIRMED."
  $payment
}

Invoke-ApiJson -Method Post -Uri "$BaseUrl/auth/login" -Body @{
  email = $Email
  password = $Password
} | Out-Null

$context = Get-CompanyContext
$results = [ordered]@{}

$rejectPo = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders" -Body @{
  companyId = $context.Company.id
  supplierId = $context.Supplier.id
  paymentTermId = $context.Supplier.paymentTermId
  warehouseId = $context.Warehouse.id
  currency = 'USD'
  notes = 'smoke-reject'
  items = @(
    @{
      productVariantId = $context.Variant.id
      quantity = 1
      unitCost = '7.00'
      discountAmount = '0.00'
      taxAmount = '0.00'
    }
  )
}
$rejectSubmitted = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders/$($rejectPo.id)/submit?companyId=$($context.Company.id)" -Body @{}
$rejectFinal = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders/$($rejectPo.id)/reject?companyId=$($context.Company.id)" -Body @{ reason = 'Smoke test reject path' }
Assert-True ($rejectFinal.status -eq 'REJECTED') "Purchase order $($rejectPo.id) did not move to REJECTED."
$results.reject = [ordered]@{
  purchaseOrderId = $rejectPo.id
  afterSubmit = $rejectSubmitted.status
  finalStatus = $rejectFinal.status
}

$voidFlow = New-ReleasedPurchaseOrder -Context $context -ScenarioTag 'invoice-void' -UnitCost '8.00'
$voidReceipt = Receive-PurchaseOrder -Context $context -ReleasedPurchaseOrder $voidFlow -ScenarioTag 'invoice-void'
$voidPostedInvoice = Post-InvoiceForPurchaseOrder -Context $context -PurchaseOrderId $voidFlow.PurchaseOrder.id
$voidedInvoice = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-invoices/$($voidPostedInvoice.id)/void?companyId=$($context.Company.id)" -Body @{ reason = 'Smoke test void path' }
Assert-True ($voidedInvoice.status -eq 'VOIDED') "Purchase invoice $($voidPostedInvoice.id) did not move to VOIDED."
$results.invoiceVoid = [ordered]@{
  purchaseOrderId = $voidFlow.PurchaseOrder.id
  goodsReceiptId = $voidReceipt.id
  postedStatus = $voidPostedInvoice.status
  voidStatus = $voidedInvoice.status
}

$reallocateA = New-ReleasedPurchaseOrder -Context $context -ScenarioTag 'reallocate-a' -UnitCost '12.00'
$receiptA = Receive-PurchaseOrder -Context $context -ReleasedPurchaseOrder $reallocateA -ScenarioTag 'reallocate-a'
$invoiceA = Post-InvoiceForPurchaseOrder -Context $context -PurchaseOrderId $reallocateA.PurchaseOrder.id

$reallocateB = New-ReleasedPurchaseOrder -Context $context -ScenarioTag 'reallocate-b' -UnitCost '12.00'
$receiptB = Receive-PurchaseOrder -Context $context -ReleasedPurchaseOrder $reallocateB -ScenarioTag 'reallocate-b'
$invoiceB = Post-InvoiceForPurchaseOrder -Context $context -PurchaseOrderId $reallocateB.PurchaseOrder.id

$payment = Create-PaymentForInvoice -Context $context -InvoiceId $invoiceA.id -Amount '12.00' -ScenarioTag 'reallocate'
$reallocatedPayment = Invoke-ApiJson -Method Post -Uri "$BaseUrl/payments/$($payment.id)/reallocate?companyId=$($context.Company.id)" -Body @{
  reason = 'Smoke test reallocation'
  allocations = @(
    @{
      referenceType = 'PURCHASE_INVOICE'
      referenceId = $invoiceB.id
      allocatedAmount = '12.00'
    }
  )
}
$invoiceAAfterReallocate = Invoke-ApiJson -Method Get -Uri "$BaseUrl/purchase-invoices/$($invoiceA.id)?companyId=$($context.Company.id)"
$invoiceBAfterReallocate = Invoke-ApiJson -Method Get -Uri "$BaseUrl/purchase-invoices/$($invoiceB.id)?companyId=$($context.Company.id)"
Assert-True ($invoiceAAfterReallocate.balanceAmount -eq '12.00') "Invoice $($invoiceA.id) did not return to the full open balance after reallocation."
Assert-True ($invoiceBAfterReallocate.balanceAmount -eq '0.00') "Invoice $($invoiceB.id) did not become fully settled after reallocation."

$reversedPayment = Invoke-ApiJson -Method Post -Uri "$BaseUrl/payments/$($payment.id)/reverse?companyId=$($context.Company.id)" -Body @{
  reason = 'Smoke test reverse'
}
$invoiceAAfterReverse = Invoke-ApiJson -Method Get -Uri "$BaseUrl/purchase-invoices/$($invoiceA.id)?companyId=$($context.Company.id)"
$invoiceBAfterReverse = Invoke-ApiJson -Method Get -Uri "$BaseUrl/purchase-invoices/$($invoiceB.id)?companyId=$($context.Company.id)"
Assert-True ($reversedPayment.status -eq 'CANCELLED') "Payment $($payment.id) did not move to CANCELLED after reversal."
Assert-True ($invoiceAAfterReverse.balanceAmount -eq '12.00') "Invoice $($invoiceA.id) did not stay fully open after reversal."
Assert-True ($invoiceBAfterReverse.balanceAmount -eq '12.00') "Invoice $($invoiceB.id) did not reopen after reversal."
$results.paymentLifecycle = [ordered]@{
  paymentId = $payment.id
  initialStatus = $payment.status
  reallocatedStatus = $reallocatedPayment.status
  reversedStatus = $reversedPayment.status
  invoiceAAfterReallocateBalance = $invoiceAAfterReallocate.balanceAmount
  invoiceBAfterReallocateBalance = $invoiceBAfterReallocate.balanceAmount
  invoiceAAfterReverseBalance = $invoiceAAfterReverse.balanceAmount
  invoiceBAfterReverseBalance = $invoiceBAfterReverse.balanceAmount
  receiptAId = $receiptA.id
  receiptBId = $receiptB.id
}

$closeFlow = New-ReleasedPurchaseOrder -Context $context -ScenarioTag 'close' -UnitCost '11.00'
$closeReceipt = Receive-PurchaseOrder -Context $context -ReleasedPurchaseOrder $closeFlow -ScenarioTag 'close'
$closeInvoice = Post-InvoiceForPurchaseOrder -Context $context -PurchaseOrderId $closeFlow.PurchaseOrder.id
$closePayment = Create-PaymentForInvoice -Context $context -InvoiceId $closeInvoice.id -Amount '11.00' -ScenarioTag 'close'
$closedPo = Invoke-ApiJson -Method Post -Uri "$BaseUrl/purchase-orders/$($closeFlow.PurchaseOrder.id)/close?companyId=$($context.Company.id)" -Body @{
  reason = 'Smoke test close path'
}
Assert-True ($closedPo.status -eq 'CLOSED') "Purchase order $($closeFlow.PurchaseOrder.id) did not move to CLOSED."
$results.close = [ordered]@{
  purchaseOrderId = $closeFlow.PurchaseOrder.id
  goodsReceiptId = $closeReceipt.id
  invoiceId = $closeInvoice.id
  paymentId = $closePayment.id
  finalStatus = $closedPo.status
}

[pscustomobject]@{
  baseUrl = $BaseUrl
  companyCode = $context.Company.code
  companyId = $context.Company.id
  supplierCode = $context.Supplier.supplierCode
  paymentMethodCode = $context.PaymentMethod.code
  variantSku = $context.Variant.sku
  results = $results
} | ConvertTo-Json -Depth 20
