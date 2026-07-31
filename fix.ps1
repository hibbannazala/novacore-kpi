$files = @(
    "src\app\dashboard\executive\page.tsx",
    "src\app\dashboard\executive\reports\page.tsx",
    "src\app\dashboard\executive\team\page.tsx",
    "src\app\dashboard\head\penugasan\page.tsx",
    "src\app\dashboard\head\reports\page.tsx",
    "src\app\dashboard\hr\reports\page.tsx"
)

foreach ($f in $files) {
    (Get-Content $f) -replace 'import \{ useKpiSettings \} from "@/hooks/useKpiSettings";', 'import { useAllKpiSettings } from "@/hooks/useKpiSettings";' `
                     -replace 'const \{ getWeights \} = useKpiSettings\(\);', 'const { getWeights } = useAllKpiSettings();' `
                     -replace 'const \{ getWeights, isLoading: sl \} = useKpiSettings\(\);', 'const { getWeights, isLoading: sl } = useAllKpiSettings();' | Set-Content $f
    Write-Host "Updated $f"
}
