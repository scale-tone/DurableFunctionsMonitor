using System;
using System.Linq;
using System.Text.RegularExpressions;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // A parsed $filter clause
    class FilterClause
    {
        public FilterClause(string filterString)
        {
            if (filterString == null)
            {
                filterString = string.Empty;
            }

            filterString = this.ExtractTimeRange(filterString);
            filterString = this.ExtractRuntimeStatuses(filterString);
            this.ExtractPredicate(filterString);
        }

        public Func<string, bool> Predicate { get; private set; }
        public string FieldName { get; private set; }

        public DateTime? TimeFrom { get; private set; }
        public DateTime? TimeTill { get; private set; }
        public string[] RuntimeStatuses { get; private set; }

        private string ExtractTimeRange(string filterClause)
        {
            this.TimeFrom = null;
            this.TimeTill = null;

            if (string.IsNullOrEmpty(filterClause))
            {
                return filterClause;
            }

            var match = TimeFromRegex.Match(filterClause);
            if (match.Success)
            {
                this.TimeFrom = DateTime.Parse(match.Groups[2].Value);
                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            match = TimeTillRegex.Match(filterClause);
            if (match.Success)
            {
                this.TimeTill = DateTime.Parse(match.Groups[2].Value);
                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            return filterClause;
        }

        private string ExtractRuntimeStatuses(string filterClause)
        {
            this.RuntimeStatuses = null;

            if (string.IsNullOrEmpty(filterClause))
            {
                return filterClause;
            }

            var match = RuntimeStatusRegex.Match(filterClause);
            if (match.Success)
            {
                this.RuntimeStatuses = match.Groups[2].Value
                    .Split(',').Where(s => !string.IsNullOrEmpty(s))
                    .Select(s => s.Trim(' ', '\'')).ToArray();

                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            return filterClause;
        }

        private void ExtractPredicate(string filterString)
        {
            var match = StartsWithRegex.Match(filterString);
            if (match.Success)
            {
                // startswith(field-name, 'value') eq true|false

                bool result = true;
                if (match.Groups.Count > 4)
                {
                    result = match.Groups[4].Value != "false";
                }
                string arg = match.Groups[2].Value;

                this.Predicate = (v) => v.StartsWith(arg) == result;
            }
            else
            {
                match = ContainsRegex.Match(filterString);
                if (match.Success)
                {
                    // contains(field-name, 'value') eq true|false

                    bool result = true;
                    if (match.Groups.Count > 4)
                    {
                        result = match.Groups[4].Value != "false";
                    }
                    string arg = match.Groups[2].Value;

                    this.Predicate = (v) => v.Contains(arg) == result;
                }
                else
                {
                    match = EqRegex.Match(filterString);
                    if (match.Success)
                    {
                        // field-name eq|ne 'value'
                        string value = match.Groups[3].Value;
                        string op = match.Groups[2].Value;

                        this.Predicate = (v) =>
                        {
                            bool res = value == "null" ? string.IsNullOrEmpty(v) : v == value;

                            return op == "ne" ? !res : res;
                        };
                    }
                }
            }

            if (this.Predicate != null)
            {
                this.FieldName = match.Groups[1].Value;
            }
        }

        private static readonly Regex StartsWithRegex = new Regex(@"startswith\((\w+),\s*'([^']+)'\)\s*(eq)?\s*(true|false)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ContainsRegex = new Regex(@"contains\((\w+),\s*'([^']+)'\)\s*(eq)?\s*(true|false)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EqRegex = new Regex(@"(\w+)\s*(eq|ne)\s*'([^']+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex RuntimeStatusRegex = new Regex(@"\s*(and\s*)?runtimeStatus in \(([^\)]*)\)(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeFromRegex = new Regex(@"\s*(and\s*)?createdTime ge '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeTillRegex = new Regex(@"\s*(and\s*)?createdTime le '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}