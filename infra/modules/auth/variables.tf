variable "name" {
  type = string
}

variable "groups" {
  description = "User-pool groups mirroring the Salesforce permission sets (name -> description)"
  type        = map(string)
}
